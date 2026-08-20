import { prisma } from "@/lib/prisma";
import { getPaymentGateway } from "@/lib/payment-gateway";
import {
  InvalidReservationStateException,
  ReservationExpiredException,
  ReservationNotFoundException,
} from "@/server/domain/errors";
import { hasPassed } from "@/lib/timezone";
import {
  confirmReservationPayment,
  markPaymentFailed,
  type ReservationWithDetails,
} from "@/server/services/reservation.service";

export async function initiateOnlinePayment(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { payments: true, customer: true },
  });
  if (!reservation) throw new ReservationNotFoundException();

  if (reservation.status !== "PENDING_PAYMENT") {
    throw new InvalidReservationStateException(
      "Esta reserva ya no está pendiente de pago."
    );
  }
  if (reservation.expiresAt && hasPassed(reservation.expiresAt)) {
    throw new ReservationExpiredException();
  }

  const payment = reservation.payments.find((p) => p.method === "ONLINE" && p.status === "PENDING");
  if (!payment) {
    throw new InvalidReservationStateException("Esta reserva no tiene un pago en línea pendiente.");
  }

  const gateway = getPaymentGateway();
  const appUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const redirectUrl = new URL(`${appUrl}/reserva/${reservation.code}/estado`);
  redirectUrl.searchParams.set("contact", reservation.customer.whatsapp);

  const result = await gateway.createPayment({
    reservationId: reservation.id,
    reference: reservation.code,
    amountInCents: reservation.totalAmount * 100,
    currency: "COP",
    customerEmail: reservation.customer.email ?? undefined,
    redirectUrl: redirectUrl.toString(),
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: { providerReference: reservation.code },
  });

  return result;
}

/**
 * Procesa un evento entrante de la pasarela de forma idempotente: registra el
 * evento crudo (constraint único) y solo confirma la reserva si el estado del
 * pago es realmente aprobado, re-consultando la transacción para no confiar
 * ciegamente en el payload del webhook (secciones 22 y 25).
 */
export async function processGatewayWebhook(
  rawBody: string,
  headers: Headers
): Promise<{ handled: boolean; reservation?: ReservationWithDetails }> {
  const gateway = getPaymentGateway();
  const result = await gateway.processWebhook(rawBody, headers);

  if (!result.valid) {
    console.warn("[payments] webhook con firma inválida, ignorado");
    return { handled: false };
  }

  const payment = await prisma.payment.findFirst({
    where: { providerReference: result.reference, method: "ONLINE" },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) {
    console.warn(`[payments] webhook para referencia desconocida: ${result.reference}`);
    return { handled: false };
  }

  try {
    await prisma.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        provider: gateway.name,
        providerTransactionId: result.providerTxId,
        eventType: result.event,
        payload: result.raw as never,
      },
    });
  } catch {
    // Constraint única (provider + providerTransactionId + eventType) ya existe:
    // este evento ya fue procesado antes. Responder éxito sin reprocesar.
    return { handled: true };
  }

  if (result.status !== "APPROVED") {
    if (result.status === "DECLINED" || result.status === "FAILED") {
      await markPaymentFailed({
        reservationId: payment.reservationId,
        paymentId: payment.id,
        rawResponse: result.raw as never,
      });
    }
    return { handled: true };
  }

  // Re-verificación oficial contra la pasarela antes de confirmar (no basta el webhook).
  const officialStatus = await gateway.checkPayment(result.providerTxId);
  if (officialStatus.status !== "APPROVED") {
    console.warn(
      `[payments] webhook indicaba APPROVED pero la consulta oficial dice ${officialStatus.status}`
    );
    return { handled: true };
  }
  if (officialStatus.amountInCents !== payment.amount * 100) {
    console.error(
      `[payments] monto no coincide: pagado=${officialStatus.amountInCents} esperado=${payment.amount * 100}`
    );
    return { handled: true };
  }

  const { reservation } = await confirmReservationPayment({
    reservationId: payment.reservationId,
    paymentId: payment.id,
    providerReference: result.reference,
    providerTxId: result.providerTxId,
    rawResponse: result.raw as never,
  });

  return { handled: true, reservation };
}
