import type { Prisma, Reservation, ReservationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateReservationCode } from "@/lib/codegen";
import { generateQrToken, verifyQrToken } from "@/lib/qr";
import { now, hasPassed } from "@/lib/timezone";
import {
  InsufficientCapacityException,
  InvalidReservationStateException,
  ReservationNotFoundException,
  ShowtimeNotAvailableException,
  ShowtimeNotFoundException,
  AlreadyCheckedInException,
  ValidationException,
} from "@/server/domain/errors";
import { lockShowtimeForUpdate } from "@/server/services/availability.service";
import { getShowtimeSeatingState, findSeatingPlan } from "@/server/services/seating.service";
import { priceReservationItems, type ReservationItemInput } from "@/server/services/pricing.service";
import { getEnabledTicketTypesForShowtime } from "@/server/services/showtime.service";
import { findOrCreateCustomer, type CustomerInput } from "@/server/services/customer.service";
import { getSettings } from "@/server/services/settings.service";
import { recordAudit } from "@/server/services/audit.service";
import { queueNotification } from "@/server/services/notification.service";

const RESERVATION_INCLUDE = {
  items: true,
  showtime: { include: { movie: true } },
  customer: true,
  payments: { orderBy: { createdAt: "desc" as const } },
  checkIn: true,
  moduleAssignments: { include: { venueModule: true } },
} satisfies Prisma.ReservationInclude;

export type ReservationWithDetails = Prisma.ReservationGetPayload<{
  include: typeof RESERVATION_INCLUDE;
}>;

export type ReservationSource = "WEB" | "ADMIN_MANUAL" | "WHATSAPP" | "PHONE" | "WALK_IN";
export type ManualPaymentMethod = "CASH" | "BANK_TRANSFER" | "OTHER";

export interface CreateReservationInput {
  showtimeId: string;
  adults: number;
  children: number;
  items: ReservationItemInput[];
  customer: CustomerInput;
  source: ReservationSource;
  paymentMethod: "ONLINE" | ManualPaymentMethod;
  adminUserId?: string | null;
}

async function generateUniqueCode(tx: Prisma.TransactionClient): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateReservationCode();
    const existing = await tx.reservation.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("No se pudo generar un código de reserva único, intenta de nuevo.");
}

/**
 * Crea una reserva PENDING_PAYMENT bloqueando cupos de forma segura ante
 * concurrencia. Es el único punto de entrada para reservar, usado tanto por
 * el flujo público (web) como por el administrador (manual/efectivo/etc.).
 */
export async function createReservation(
  input: CreateReservationInput
): Promise<ReservationWithDetails> {
  const settings = await getSettings();

  return prisma.$transaction(async (tx) => {
    const locked = await lockShowtimeForUpdate(tx, input.showtimeId);
    if (!locked) throw new ShowtimeNotFoundException();

    const showtime = await tx.showtime.findUniqueOrThrow({ where: { id: input.showtimeId } });

    if (showtime.status === "CANCELLED") {
      throw new ShowtimeNotAvailableException("Esta función fue cancelada.");
    }
    if (showtime.status === "FINISHED" || hasPassed(showtime.startsAt)) {
      throw new ShowtimeNotAvailableException("Esta función ya finalizó.");
    }
    if (input.source === "WEB" && showtime.status !== "PUBLISHED") {
      throw new ShowtimeNotAvailableException();
    }
    if (showtime.status === "BOOKING_CLOSED" && input.source === "WEB") {
      throw new ShowtimeNotAvailableException("Las reservas para esta función están cerradas.");
    }

    // Las funciones especiales tienen un precio de menú fijo por persona: el
    // ítem a cobrar lo decide el servidor (nunca el cliente), ignorando
    // cualquier selección de productos que haya llegado en la solicitud.
    let items = input.items;
    if (showtime.isSpecial) {
      if (!showtime.specialTicketTypeId) {
        throw new ShowtimeNotAvailableException("Esta función especial todavía no tiene un menú configurado.");
      }
      items = [{ ticketTypeId: showtime.specialTicketTypeId, quantity: input.adults + input.children }];
    } else {
      const enabled = await getEnabledTicketTypesForShowtime(input.showtimeId);
      const enabledIds = new Set(enabled.map((t) => t.id));
      for (const item of input.items) {
        if (!enabledIds.has(item.ticketTypeId)) {
          throw new ValidationException("Uno de los productos seleccionados no está disponible para esta función.");
        }
      }
    }

    const pricing = await priceReservationItems(items, input.adults, input.children, tx);

    const seating = await getShowtimeSeatingState(input.showtimeId, tx);
    const effectiveCapacity = Math.min(showtime.capacity, seating.physicalMax);
    const availableByCeiling = effectiveCapacity - seating.occupiedSeats;
    if (availableByCeiling < pricing.totalPeople) {
      throw new InsufficientCapacityException(Math.max(0, availableByCeiling));
    }

    const seatingPlan = findSeatingPlan(seating.freeModules, seating.remainingAux, pricing.totalPeople);
    if (!seatingPlan) {
      throw new InsufficientCapacityException(Math.max(0, availableByCeiling), { unpackable: true });
    }

    const customer = await findOrCreateCustomer(input.customer, tx);
    const code = await generateUniqueCode(tx);

    const holdMinutes =
      input.paymentMethod === "ONLINE"
        ? settings.reservation_hold_minutes
        : settings.cash_reservation_hold_hours * 60;
    const expiresAt = new Date(now().getTime() + holdMinutes * 60_000);

    const reservation = await tx.reservation.create({
      data: {
        code,
        customerId: customer.id,
        showtimeId: input.showtimeId,
        adults: input.adults,
        children: input.children,
        totalAmount: pricing.totalAmount,
        status: "PENDING_PAYMENT",
        source: input.source,
        expiresAt,
        items: {
          create: pricing.items.map((i) => ({
            ticketTypeId: i.ticketTypeId,
            ticketTypeName: i.ticketTypeName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.total,
          })),
        },
        payments: {
          create: {
            method: input.paymentMethod,
            status: "PENDING",
            amount: pricing.totalAmount,
          },
        },
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: "PENDING_PAYMENT",
            changedById: input.adminUserId ?? null,
            reason:
              input.source === "WEB"
                ? "Reserva creada por el cliente"
                : "Reserva manual creada por administrador",
          },
        },
        moduleAssignments: {
          create: seatingPlan.map((s) => ({
            venueModuleId: s.venueModuleId,
            seatsOccupied: s.seatsOccupied,
            usesAuxiliary: s.usesAuxiliary,
          })),
        },
      },
      include: RESERVATION_INCLUDE,
    });

    if (input.adminUserId) {
      await recordAudit({
        adminUserId: input.adminUserId,
        action: "CREATE_MANUAL_RESERVATION",
        entityType: "Reservation",
        entityId: reservation.id,
        details: { code: reservation.code, totalAmount: reservation.totalAmount, method: input.paymentMethod },
        tx,
      });
    }

    return reservation;
  });
}

export async function getReservationByCode(code: string): Promise<ReservationWithDetails> {
  const reservation = await prisma.reservation.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: RESERVATION_INCLUDE,
  });
  if (!reservation) throw new ReservationNotFoundException();
  return reservation;
}

export async function getReservationById(id: string): Promise<ReservationWithDetails> {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: RESERVATION_INCLUDE,
  });
  if (!reservation) throw new ReservationNotFoundException();
  return reservation;
}

export interface ListReservationsFilters {
  status?: ReservationStatus[];
  showtimeId?: string;
  search?: string; // código, nombre o whatsapp
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

export async function listReservations(filters: ListReservationsFilters = {}) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters.pageSize && filters.pageSize > 0 ? Math.min(filters.pageSize, 100) : 25;

  const where: Prisma.ReservationWhereInput = {
    status: filters.status ? { in: filters.status } : undefined,
    showtimeId: filters.showtimeId,
    showtime: filters.from || filters.to ? { startsAt: { gte: filters.from, lte: filters.to } } : undefined,
    OR: filters.search
      ? [
          { code: { contains: filters.search, mode: "insensitive" } },
          { customer: { fullName: { contains: filters.search, mode: "insensitive" } } },
          { customer: { whatsapp: { contains: filters.search } } },
        ]
      : undefined,
  };

  const [items, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      include: RESERVATION_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.reservation.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

/**
 * Punto único de confirmación de pago (usado por el webhook de la pasarela y
 * por "marcar como pagada" en admin). Idempotente: si la reserva ya está
 * confirmada, no hace nada. Si la reserva ya expiró/canceló, NO revive la
 * reserva automáticamente (los cupos pudieron haberse re-vendido) y deja
 * constancia para revisión manual.
 */
export async function confirmReservationPayment(params: {
  reservationId: string;
  paymentId?: string;
  providerReference?: string | null;
  providerTxId?: string | null;
  rawResponse?: Prisma.InputJsonValue;
  confirmedById?: string | null;
  cashReference?: string | null;
}): Promise<{ reservation: ReservationWithDetails; requiresManualReview: boolean }> {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: params.reservationId },
      include: RESERVATION_INCLUDE,
    });
    if (!reservation) throw new ReservationNotFoundException();

    // Idempotencia: ya confirmada -> no-op exitoso.
    if (["PAYMENT_APPROVED", "CONFIRMED", "CHECKED_IN"].includes(reservation.status)) {
      return { reservation, requiresManualReview: false };
    }

    const payment = params.paymentId
      ? reservation.payments.find((p) => p.id === params.paymentId)
      : reservation.payments[0];

    if (payment) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "APPROVED",
          providerReference: params.providerReference ?? payment.providerReference,
          providerTxId: params.providerTxId ?? payment.providerTxId,
          rawResponse: params.rawResponse ?? payment.rawResponse ?? undefined,
          confirmedById: params.confirmedById ?? null,
          confirmedAt: now(),
          cashReference: params.cashReference ?? payment.cashReference,
        },
      });
    }

    // Reserva ya no está en un estado que pueda confirmarse (expiró o se canceló):
    // el pago queda registrado como aprobado, pero requiere revisión manual del
    // administrador (posible reembolso) porque el cupo pudo haberse re-vendido.
    if (reservation.status !== "PENDING_PAYMENT") {
      await recordAudit({
        adminUserId: params.confirmedById ?? null,
        action: "PAYMENT_APPROVED_AFTER_EXPIRATION",
        entityType: "Reservation",
        entityId: reservation.id,
        details: { previousStatus: reservation.status },
        tx,
      });
      const refreshed = await tx.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
        include: RESERVATION_INCLUDE,
      });
      return { reservation: refreshed, requiresManualReview: true };
    }

    const qrToken = generateQrToken(reservation.id);

    const updated = await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status: "CONFIRMED",
        qrToken,
        statusHistory: {
          create: [
            {
              fromStatus: "PENDING_PAYMENT",
              toStatus: "PAYMENT_APPROVED",
              changedById: params.confirmedById ?? null,
              reason: "Pago aprobado",
            },
            {
              fromStatus: "PAYMENT_APPROVED",
              toStatus: "CONFIRMED",
              changedById: params.confirmedById ?? null,
              reason: "Reserva confirmada",
            },
          ],
        },
      },
      include: RESERVATION_INCLUDE,
    });

    if (params.confirmedById) {
      await recordAudit({
        adminUserId: params.confirmedById,
        action: "CONFIRM_PAYMENT",
        entityType: "Reservation",
        entityId: reservation.id,
        details: { code: reservation.code, method: payment?.method, amount: reservation.totalAmount },
        tx,
      });
    }

    return { reservation: updated, requiresManualReview: false };
  }).then(async (result) => {
    if (!result.requiresManualReview) {
      await queueNotification({
        reservationId: result.reservation.id,
        channel: "EMAIL",
        event: "RESERVATION_CONFIRMED",
        payload: { code: result.reservation.code },
      });
      await queueNotification({
        reservationId: result.reservation.id,
        channel: "EMAIL",
        event: "ADMIN_NEW_SALE",
        payload: { code: result.reservation.code },
      });
    }
    return result;
  });
}

export async function markPaymentFailed(params: {
  reservationId: string;
  paymentId?: string;
  reason?: string;
  rawResponse?: Prisma.InputJsonValue;
}) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: params.reservationId },
    include: RESERVATION_INCLUDE,
  });
  if (!reservation) throw new ReservationNotFoundException();

  const payment = params.paymentId
    ? reservation.payments.find((p) => p.id === params.paymentId)
    : reservation.payments[0];

  if (payment && payment.status === "PENDING") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "DECLINED", rawResponse: params.rawResponse ?? payment.rawResponse ?? undefined },
    });
  }
  // La reserva sigue PENDING_PAYMENT: el cliente puede reintentar el pago
  // sin crear una segunda reserva, hasta que expire.
  return reservation;
}

export async function cancelReservation(params: {
  reservationId: string;
  reason: string;
  adminUserId?: string | null;
}): Promise<ReservationWithDetails> {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: params.reservationId },
      include: RESERVATION_INCLUDE,
    });
    if (!reservation) throw new ReservationNotFoundException();

    if (!["PENDING_PAYMENT", "PAYMENT_APPROVED", "CONFIRMED"].includes(reservation.status)) {
      throw new InvalidReservationStateException(
        "Esta reserva no se puede cancelar en su estado actual."
      );
    }

    const updated = await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status: "CANCELLED",
        cancelledAt: now(),
        cancelReason: params.reason,
        cancelledById: params.adminUserId ?? null,
        statusHistory: {
          create: {
            fromStatus: reservation.status,
            toStatus: "CANCELLED",
            changedById: params.adminUserId ?? null,
            reason: params.reason,
          },
        },
      },
      include: RESERVATION_INCLUDE,
    });

    if (params.adminUserId) {
      await recordAudit({
        adminUserId: params.adminUserId,
        action: "CANCEL_RESERVATION",
        entityType: "Reservation",
        entityId: reservation.id,
        details: { code: reservation.code, reason: params.reason },
        tx,
      });
    }

    return updated;
  }).then(async (reservation) => {
    await queueNotification({
      reservationId: reservation.id,
      channel: "EMAIL",
      event: "RESERVATION_CANCELLED",
      payload: { code: reservation.code, reason: params.reason },
    });
    return reservation;
  });
}

export async function rescheduleReservation(params: {
  reservationId: string;
  newShowtimeId: string;
  adminUserId: string;
}): Promise<ReservationWithDetails> {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: params.reservationId },
      include: RESERVATION_INCLUDE,
    });
    if (!reservation) throw new ReservationNotFoundException();
    if (reservation.status !== "CONFIRMED") {
      throw new InvalidReservationStateException(
        "Solo se pueden reagendar reservas confirmadas."
      );
    }
    if (reservation.showtimeId === params.newShowtimeId) {
      throw new InvalidReservationStateException("Selecciona una función distinta a la actual.");
    }

    // Orden determinístico de locks para evitar deadlocks entre reservas cruzadas.
    const idsToLock = [reservation.showtimeId, params.newShowtimeId].sort();
    for (const id of idsToLock) {
      const locked = await lockShowtimeForUpdate(tx, id);
      if (!locked) throw new ShowtimeNotFoundException();
    }

    const newShowtime = await tx.showtime.findUniqueOrThrow({ where: { id: params.newShowtimeId } });
    if (newShowtime.status === "CANCELLED" || newShowtime.status === "FINISHED") {
      throw new ShowtimeNotAvailableException("La nueva función no está disponible.");
    }
    if (hasPassed(newShowtime.startsAt)) {
      throw new ShowtimeNotAvailableException("No puedes reagendar a una función que ya inició.");
    }

    const totalPeople = reservation.adults + reservation.children;
    const seating = await getShowtimeSeatingState(params.newShowtimeId, tx);
    const effectiveCapacity = Math.min(newShowtime.capacity, seating.physicalMax);
    const availableByCeiling = effectiveCapacity - seating.occupiedSeats;
    if (availableByCeiling < totalPeople) {
      throw new InsufficientCapacityException(Math.max(0, availableByCeiling));
    }
    const seatingPlan = findSeatingPlan(seating.freeModules, seating.remainingAux, totalPeople);
    if (!seatingPlan) {
      throw new InsufficientCapacityException(Math.max(0, availableByCeiling), { unpackable: true });
    }

    const code = await generateUniqueCode(tx);
    const newReservation = await tx.reservation.create({
      data: {
        code,
        customerId: reservation.customerId,
        showtimeId: params.newShowtimeId,
        adults: reservation.adults,
        children: reservation.children,
        totalAmount: reservation.totalAmount,
        status: "CONFIRMED",
        source: reservation.source,
        rescheduledFromId: reservation.id,
        items: {
          create: reservation.items.map((i) => ({
            ticketTypeId: i.ticketTypeId,
            ticketTypeName: i.ticketTypeName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.total,
          })),
        },
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: "CONFIRMED",
            changedById: params.adminUserId,
            reason: `Reagendada desde la reserva ${reservation.code}`,
          },
        },
        moduleAssignments: {
          create: seatingPlan.map((s) => ({
            venueModuleId: s.venueModuleId,
            seatsOccupied: s.seatsOccupied,
            usesAuxiliary: s.usesAuxiliary,
          })),
        },
      },
      include: RESERVATION_INCLUDE,
    });

    const qrToken = generateQrToken(newReservation.id);
    const finalReservation = await tx.reservation.update({
      where: { id: newReservation.id },
      data: { qrToken },
      include: RESERVATION_INCLUDE,
    });

    await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status: "CANCELLED",
        cancelledAt: now(),
        cancelReason: `Reagendada a la nueva reserva ${newReservation.code}`,
        cancelledById: params.adminUserId,
        qrToken: null,
        statusHistory: {
          create: {
            fromStatus: reservation.status,
            toStatus: "CANCELLED",
            changedById: params.adminUserId,
            reason: `Reagendada a la nueva reserva ${newReservation.code}`,
          },
        },
      },
    });

    await recordAudit({
      adminUserId: params.adminUserId,
      action: "RESCHEDULE_RESERVATION",
      entityType: "Reservation",
      entityId: reservation.id,
      details: { fromCode: reservation.code, toCode: newReservation.code },
      tx,
    });

    return finalReservation;
  }).then(async (reservation) => {
    await queueNotification({
      reservationId: reservation.id,
      channel: "EMAIL",
      event: "RESERVATION_RESCHEDULED",
      payload: { code: reservation.code },
    });
    return reservation;
  });
}

export async function checkInByQrToken(params: {
  token: string;
  adminUserId: string;
  force?: boolean;
}): Promise<ReservationWithDetails> {
  const verified = verifyQrToken(params.token);
  if (!verified) throw new ReservationNotFoundException();

  return checkInReservation({
    reservationId: verified.reservationId,
    adminUserId: params.adminUserId,
    force: params.force,
  });
}

export async function checkInReservation(params: {
  reservationId: string;
  adminUserId: string;
  force?: boolean;
}): Promise<ReservationWithDetails> {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: params.reservationId },
      include: RESERVATION_INCLUDE,
    });
    if (!reservation) throw new ReservationNotFoundException();

    if (reservation.status === "CHECKED_IN" && reservation.checkIn) {
      if (!params.force) {
        throw new AlreadyCheckedInException(reservation.checkIn.checkedInAt);
      }
    } else if (!["CONFIRMED", "PAYMENT_APPROVED"].includes(reservation.status)) {
      throw new InvalidReservationStateException(
        reservationStateMessage(reservation.status)
      );
    }

    const updated = await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status: "CHECKED_IN",
        statusHistory: {
          create: {
            fromStatus: reservation.status,
            toStatus: "CHECKED_IN",
            changedById: params.adminUserId,
            reason: params.force ? "Re-ingreso autorizado por administrador" : "Check-in por QR",
          },
        },
        checkIn: {
          upsert: {
            create: { checkedInById: params.adminUserId, method: "QR" },
            update: { checkedInAt: now(), checkedInById: params.adminUserId },
          },
        },
      },
      include: RESERVATION_INCLUDE,
    });

    await recordAudit({
      adminUserId: params.adminUserId,
      action: params.force ? "FORCE_CHECK_IN" : "CHECK_IN",
      entityType: "Reservation",
      entityId: reservation.id,
      details: { code: reservation.code },
      tx,
    });

    return updated;
  });
}

function reservationStateMessage(status: ReservationStatus): string {
  switch (status) {
    case "CANCELLED":
      return "Esta reserva fue cancelada y no puede ingresar.";
    case "EXPIRED":
      return "Esta reserva expiró y no puede ingresar.";
    case "REFUNDED":
      return "Esta reserva fue reembolsada y no puede ingresar.";
    case "NO_SHOW":
      return "Esta reserva fue marcada como no-show.";
    case "PENDING_PAYMENT":
      return "Esta reserva todavía no tiene el pago confirmado.";
    default:
      return "Esta reserva no puede ingresar en su estado actual.";
  }
}

/** Expira reservas PENDING_PAYMENT vencidas y libera sus cupos (sección 85). */
export async function expireOverdueReservations(): Promise<number> {
  const overdue = await prisma.reservation.findMany({
    where: { status: "PENDING_PAYMENT", expiresAt: { lt: now() } },
    select: { id: true },
  });

  for (const { id } of overdue) {
    await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({ where: { id } });
      if (!reservation || reservation.status !== "PENDING_PAYMENT") return;

      await tx.reservation.update({
        where: { id },
        data: {
          status: "EXPIRED",
          statusHistory: {
            create: {
              fromStatus: "PENDING_PAYMENT",
              toStatus: "EXPIRED",
              reason: "Tiempo de reserva agotado, cupos liberados automáticamente",
            },
          },
        },
      });
      await tx.payment.updateMany({
        where: { reservationId: id, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
    });
  }

  return overdue.length;
}

export type { Reservation };
