process.env.PAYMENT_PROVIDER = "mock";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { createReservation, getReservationById } from "@/server/services/reservation.service";
import { initiateOnlinePayment, processGatewayWebhook } from "@/server/services/payment.service";
import { getPaymentGateway } from "@/lib/payment-gateway";
import { MockGateway } from "@/lib/payment-gateway/mock";
import {
  createTestMovie,
  createTestTicketType,
  createTestShowtime,
  testCustomer,
  cleanupShowtime,
  cleanupMovie,
  cleanupTicketType,
} from "./helpers";

describe("Webhook de pagos — idempotencia (sección 25/55/111)", () => {
  let movie: Awaited<ReturnType<typeof createTestMovie>>;
  let ticketType: Awaited<ReturnType<typeof createTestTicketType>>;

  beforeAll(async () => {
    movie = await createTestMovie();
    ticketType = await createTestTicketType();
  });

  afterAll(async () => {
    await cleanupMovie(movie.id);
    await cleanupTicketType(ticketType.id);
  });

  it("un webhook duplicado no confirma la reserva dos veces ni duplica pagos", async () => {
    const showtime = await createTestShowtime({ movieId: movie.id, capacity: 15 });

    const reservation = await createReservation({
      showtimeId: showtime.id,
      adults: 1,
      children: 0,
      items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
      customer: testCustomer("N"),
      source: "WEB",
      paymentMethod: "ONLINE",
    });

    const paymentInfo = await initiateOnlinePayment(reservation.id);
    const gateway = getPaymentGateway() as MockGateway;
    const txId = new URL(paymentInfo.checkoutUrl!).searchParams.get("txId")!;

    const payload = JSON.stringify({
      providerTxId: txId,
      reference: reservation.code,
      amountInCents: reservation.totalAmount * 100,
      status: "APPROVED",
      signature: gateway.sign(txId, "APPROVED"),
    });

    const first = await processGatewayWebhook(payload, new Headers());
    const second = await processGatewayWebhook(payload, new Headers());

    expect(first.handled).toBe(true);
    expect(second.handled).toBe(true);

    const refreshed = await getReservationById(reservation.id);
    expect(refreshed.status).toBe("CONFIRMED");
    expect(refreshed.payments).toHaveLength(1);

    const transactions = await prisma.paymentTransaction.findMany({
      where: { payment: { reservationId: reservation.id } },
    });
    expect(transactions).toHaveLength(1);

    await cleanupShowtime(showtime.id);
  });

  it("un pago rechazado no confirma la reserva y permite reintentar sin crear una segunda reserva", async () => {
    const showtime = await createTestShowtime({ movieId: movie.id, capacity: 15 });

    const reservation = await createReservation({
      showtimeId: showtime.id,
      adults: 1,
      children: 0,
      items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
      customer: testCustomer("O"),
      source: "WEB",
      paymentMethod: "ONLINE",
    });

    const paymentInfo = await initiateOnlinePayment(reservation.id);
    const gateway = getPaymentGateway() as MockGateway;
    const txId = new URL(paymentInfo.checkoutUrl!).searchParams.get("txId")!;

    const payload = JSON.stringify({
      providerTxId: txId,
      reference: reservation.code,
      amountInCents: reservation.totalAmount * 100,
      status: "DECLINED",
      signature: gateway.sign(txId, "DECLINED"),
    });

    await processGatewayWebhook(payload, new Headers());

    const refreshed = await getReservationById(reservation.id);
    expect(refreshed.status).toBe("PENDING_PAYMENT");
    expect(refreshed.payments[0].status).toBe("DECLINED");

    // El cliente puede reintentar sobre la MISMA reserva: no se crea una segunda.
    const totalReservationsForCustomer = await prisma.reservation.count({
      where: { showtimeId: showtime.id, customerId: refreshed.customerId },
    });
    expect(totalReservationsForCustomer).toBe(1);

    await cleanupShowtime(showtime.id);
  });
});
