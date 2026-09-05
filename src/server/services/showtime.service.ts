import { prisma } from "@/lib/prisma";
import type { ShowtimeStatus } from "@prisma/client";
import { zonedDateTimeToUtc, toDateTimeParts } from "@/lib/timezone";
import {
  CapacityBelowCommittedException,
  MovieHasReservationsException,
  ShowtimeHasReservationsException,
  ShowtimeNotFoundException,
  ValidationException,
} from "@/server/domain/errors";
import { getShowtimeAvailability } from "@/server/services/availability.service";
import { getPhysicalRoomCapacity } from "@/server/services/seating.service";

const ACTIVE_RESERVATION_STATUSES = [
  "PENDING_PAYMENT",
  "PAYMENT_APPROVED",
  "CONFIRMED",
  "CHECKED_IN",
] as const;

export interface SpecialFields {
  isSpecial?: boolean;
  specialAdImageUrl?: string | null;
  specialMenuPrice?: number | null;
  specialDescription?: string | null;
}

export interface ShowtimeInput extends SpecialFields {
  movieId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  capacity: number;
  status?: "DRAFT" | "PUBLISHED";
  /** undefined = no tocar la configuración de productos habilitados. */
  enabledTicketTypeIds?: string[];
}

export async function listShowtimes(filters: {
  from?: Date;
  to?: Date;
  status?: string[];
  publicOnly?: boolean;
} = {}) {
  return prisma.showtime.findMany({
    where: {
      startsAt: {
        gte: filters.from,
        lte: filters.to,
      },
      status: filters.status ? { in: filters.status as never } : undefined,
      // El público debe seguir viendo el día con su función aunque esté agotada o
      // con reservas cerradas (para mostrar "Agotado"/"Cerrada" en vez de que el
      // día parezca vacío); solo se ocultan borradores, canceladas y finalizadas.
      ...(filters.publicOnly ? { status: { in: ["PUBLISHED", "SOLD_OUT", "BOOKING_CLOSED"] } as never } : {}),
    },
    include: { movie: true },
    orderBy: { startsAt: "asc" },
  });
}

export async function getShowtimeById(id: string) {
  const showtime = await prisma.showtime.findUnique({ where: { id }, include: { movie: true } });
  if (!showtime) throw new ShowtimeNotFoundException();
  return showtime;
}

export async function createShowtime(input: ShowtimeInput) {
  validateShowtimeInput(input);
  await validateCapacityAgainstRoom(input.capacity);
  validateSpecialFields(input);
  const startsAt = zonedDateTimeToUtc(input.date, input.time);

  const showtime = await prisma.showtime.create({
    data: {
      movieId: input.movieId,
      startsAt,
      capacity: input.capacity,
      status: input.status ?? "DRAFT",
      isSpecial: input.isSpecial ?? false,
      specialAdImageUrl: input.specialAdImageUrl ?? null,
      specialMenuPrice: input.specialMenuPrice ?? null,
      specialDescription: input.specialDescription ?? null,
    },
  });

  if (input.isSpecial && input.specialMenuPrice) {
    const specialTicketTypeId = await upsertSpecialTicketType(null, input.specialMenuPrice);
    await prisma.showtime.update({ where: { id: showtime.id }, data: { specialTicketTypeId } });
  }

  if (input.enabledTicketTypeIds !== undefined) {
    await setEnabledTicketTypes(showtime.id, input.enabledTicketTypeIds);
  }

  return getShowtimeById(showtime.id);
}

export async function updateShowtime(
  id: string,
  patch: Partial<Omit<ShowtimeInput, "status">> & { status?: ShowtimeStatus }
) {
  const showtime = await getShowtimeById(id);

  const data: Record<string, unknown> = {};

  if (patch.movieId && patch.movieId !== showtime.movieId) {
    const activeCount = await countActiveReservations(id);
    if (activeCount > 0) {
      throw new MovieHasReservationsException();
    }
    data.movieId = patch.movieId;
  }

  if (patch.capacity !== undefined && patch.capacity !== showtime.capacity) {
    await validateCapacityAgainstRoom(patch.capacity);
    const availability = await getShowtimeAvailability(id);
    const committed = availability.confirmed + availability.pending;
    if (patch.capacity < committed) {
      throw new CapacityBelowCommittedException(committed);
    }
    data.capacity = patch.capacity;
  }

  if (patch.date || patch.time) {
    const current = toDateTimeParts(showtime.startsAt);
    const date = patch.date ?? current.date;
    const time = patch.time ?? current.time;
    data.startsAt = zonedDateTimeToUtc(date, time);
  }

  if (patch.status) {
    data.status = patch.status;
  }

  if (patch.isSpecial !== undefined) data.isSpecial = patch.isSpecial;
  if (patch.specialAdImageUrl !== undefined) data.specialAdImageUrl = patch.specialAdImageUrl;
  if (patch.specialMenuPrice !== undefined) data.specialMenuPrice = patch.specialMenuPrice;
  if (patch.specialDescription !== undefined) data.specialDescription = patch.specialDescription;

  const willBeSpecial = patch.isSpecial ?? showtime.isSpecial;
  const finalMenuPrice = patch.specialMenuPrice !== undefined ? patch.specialMenuPrice : showtime.specialMenuPrice;
  validateSpecialFields({ isSpecial: willBeSpecial, specialMenuPrice: finalMenuPrice });

  if (willBeSpecial && finalMenuPrice) {
    data.specialTicketTypeId = await upsertSpecialTicketType(showtime.specialTicketTypeId, finalMenuPrice);
  }

  const updated = await prisma.showtime.update({ where: { id }, data });

  if (patch.enabledTicketTypeIds !== undefined) {
    await setEnabledTicketTypes(id, patch.enabledTicketTypeIds);
  }

  return updated;
}

export async function publishWeek(showtimeIds: string[]) {
  if (showtimeIds.length === 0) throw new ValidationException("Selecciona al menos una función para publicar.");
  return prisma.showtime.updateMany({
    where: { id: { in: showtimeIds } },
    data: { status: "PUBLISHED", weekPublished: true },
  });
}

export async function closeBooking(id: string) {
  await getShowtimeById(id);
  return prisma.showtime.update({ where: { id }, data: { status: "BOOKING_CLOSED" } });
}

export async function reopenBooking(id: string) {
  await getShowtimeById(id);
  return prisma.showtime.update({ where: { id }, data: { status: "PUBLISHED" } });
}

export async function cancelShowtime(id: string) {
  await getShowtimeById(id);
  return prisma.showtime.update({ where: { id }, data: { status: "CANCELLED" } });
}

/**
 * Borra la función por completo (no solo cancelarla). Solo se permite si
 * NUNCA tuvo ninguna reserva (ni siquiera canceladas/expiradas) — así se
 * conserva el historial real de ventas, y solo se pueden borrar los errores
 * de programación (película equivocada, fecha mal puesta) antes de que
 * alguien alcance a reservar.
 */
export async function deleteShowtime(id: string) {
  await getShowtimeById(id);
  const totalReservations = await prisma.reservation.count({ where: { showtimeId: id } });
  if (totalReservations > 0) {
    throw new ShowtimeHasReservationsException(totalReservations);
  }
  await prisma.showtime.delete({ where: { id } });
}

export async function countActiveReservations(showtimeId: string): Promise<number> {
  return prisma.reservation.count({
    where: { showtimeId, status: { in: [...ACTIVE_RESERVATION_STATUSES] } },
  });
}

async function validateCapacityAgainstRoom(capacity: number) {
  const room = await getPhysicalRoomCapacity();
  if (capacity > room.max) {
    throw new ValidationException(
      `La capacidad no puede superar el máximo físico de la sala (${room.max} personas con todos los módulos auxiliares en uso).`
    );
  }
}

function validateShowtimeInput(input: ShowtimeInput) {
  if (!input.movieId) throw new ValidationException("Selecciona una película.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new ValidationException("Fecha inválida.");
  if (!/^\d{2}:\d{2}$/.test(input.time)) throw new ValidationException("Hora inválida.");
  if (!input.capacity || input.capacity <= 0) {
    throw new ValidationException("La capacidad debe ser mayor a 0.");
  }
}

function validateSpecialFields(input: { isSpecial?: boolean; specialMenuPrice?: number | null }) {
  if (input.isSpecial && (!input.specialMenuPrice || input.specialMenuPrice <= 0)) {
    throw new ValidationException("Una función especial necesita un valor de menú especial mayor a 0.");
  }
}

/**
 * Crea o actualiza el TicketType oculto que representa el "menú especial" de
 * una función. Se reutiliza el mismo registro entre ediciones (identificado
 * por `existingId`) para no perder el historial de reservas ya creadas con
 * ese producto si el precio cambia después.
 */
async function upsertSpecialTicketType(existingId: string | null, price: number): Promise<string> {
  if (existingId) {
    const updated = await prisma.ticketType.update({
      where: { id: existingId },
      data: { price, active: true, hidden: true },
    });
    return updated.id;
  }
  const created = await prisma.ticketType.create({
    data: {
      name: "Menú especial",
      price,
      includes: [],
      active: true,
      hidden: true,
      sortOrder: 999,
    },
  });
  return created.id;
}

/** Reemplaza por completo el set de productos habilitados para una función. */
async function setEnabledTicketTypes(showtimeId: string, ticketTypeIds: string[]) {
  await prisma.$transaction([
    prisma.showtimeTicketType.deleteMany({ where: { showtimeId } }),
    ...(ticketTypeIds.length > 0
      ? [
          prisma.showtimeTicketType.createMany({
            data: ticketTypeIds.map((ticketTypeId) => ({ showtimeId, ticketTypeId })),
          }),
        ]
      : []),
  ]);
}

/**
 * Productos disponibles para reservar en una función puntual. Sin overrides
 * configurados, aplican todos los activos (comportamiento por defecto).
 */
export async function getEnabledTicketTypesForShowtime(showtimeId: string) {
  const overrides = await prisma.showtimeTicketType.findMany({
    where: { showtimeId },
    select: { ticketTypeId: true },
  });
  if (overrides.length === 0) {
    return prisma.ticketType.findMany({ where: { active: true, hidden: false }, orderBy: { sortOrder: "asc" } });
  }
  return prisma.ticketType.findMany({
    where: { id: { in: overrides.map((o) => o.ticketTypeId) }, active: true },
    orderBy: { sortOrder: "asc" },
  });
}
