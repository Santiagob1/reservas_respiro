import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createReservation,
  cancelReservation,
  expireOverdueReservations,
  confirmReservationPayment,
  checkInReservation,
  getReservationById,
} from "@/server/services/reservation.service";
import { getShowtimeAvailability } from "@/server/services/availability.service";
import { InvalidReservationStateException, AlreadyCheckedInException } from "@/server/domain/errors";
import {
  createTestMovie,
  createTestTicketType,
  createTestShowtime,
  createTestAdmin,
  testCustomer,
  cleanupShowtime,
  cleanupMovie,
  cleanupTicketType,
  cleanupAdmin,
} from "./helpers";

describe("Ciclo de vida de la reserva", () => {
  let movie: Awaited<ReturnType<typeof createTestMovie>>;
  let ticketType: Awaited<ReturnType<typeof createTestTicketType>>;
  let admin: Awaited<ReturnType<typeof createTestAdmin>>;

  beforeAll(async () => {
    movie = await createTestMovie();
    ticketType = await createTestTicketType();
    admin = await createTestAdmin();
  });

  afterAll(async () => {
    await cleanupMovie(movie.id);
    await cleanupTicketType(ticketType.id);
    await cleanupAdmin(admin.id);
  });

  it("expira una reserva PENDING_PAYMENT vencida y libera sus cupos (sección 85)", async () => {
    const showtime = await createTestShowtime({ movieId: movie.id, capacity: 15 });

    const reservation = await createReservation({
      showtimeId: showtime.id,
      adults: 5,
      children: 0,
      items: [{ ticketTypeId: ticketType.id, quantity: 5 }],
      customer: testCustomer("F"),
      source: "WEB",
      paymentMethod: "ONLINE",
    });

    // Forzar expiración en el pasado.
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    // Antes de correr el cron: la disponibilidad YA debe excluirla (defensa en profundidad).
    const beforeCron = await getShowtimeAvailability(showtime.id);
    expect(beforeCron.available).toBe(15);

    const expiredCount = await expireOverdueReservations();
    expect(expiredCount).toBeGreaterThanOrEqual(1);

    const refreshed = await getReservationById(reservation.id);
    expect(refreshed.status).toBe("EXPIRED");

    await cleanupShowtime(showtime.id);
  });

  it("cancela una reserva confirmada, libera cupos y conserva el historial (sección 30)", async () => {
    const showtime = await createTestShowtime({ movieId: movie.id, capacity: 15 });

    const reservation = await createReservation({
      showtimeId: showtime.id,
      adults: 4,
      children: 0,
      items: [{ ticketTypeId: ticketType.id, quantity: 4 }],
      customer: testCustomer("G"),
      source: "WEB",
      paymentMethod: "ONLINE",
    });

    await cancelReservation({ reservationId: reservation.id, reason: "Prueba automatizada" });

    const availability = await getShowtimeAvailability(showtime.id);
    expect(availability.available).toBe(15);

    const cancelled = await getReservationById(reservation.id);
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelReason).toBe("Prueba automatizada");

    // La reserva NO se borra, sigue existiendo como historial.
    const stillExists = await prisma.reservation.findUnique({ where: { id: reservation.id } });
    expect(stillExists).not.toBeNull();

    await cleanupShowtime(showtime.id);
  });

  it("no permite check-in dos veces salvo override explícito (sección 36)", async () => {
    const showtime = await createTestShowtime({ movieId: movie.id, capacity: 15 });

    const reservation = await createReservation({
      showtimeId: showtime.id,
      adults: 1,
      children: 0,
      items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
      customer: testCustomer("H"),
      source: "WEB",
      paymentMethod: "ONLINE",
    });

    await confirmReservationPayment({ reservationId: reservation.id });
    await checkInReservation({ reservationId: reservation.id, adminUserId: admin.id });

    await expect(
      checkInReservation({ reservationId: reservation.id, adminUserId: admin.id })
    ).rejects.toBeInstanceOf(AlreadyCheckedInException);

    // Con override explícito sí se permite.
    const forced = await checkInReservation({
      reservationId: reservation.id,
      adminUserId: admin.id,
      force: true,
    });
    expect(forced.status).toBe("CHECKED_IN");

    await cleanupShowtime(showtime.id);
  });

  it("es idempotente ante una doble confirmación de pago (sección 25/111)", async () => {
    const showtime = await createTestShowtime({ movieId: movie.id, capacity: 15 });

    const reservation = await createReservation({
      showtimeId: showtime.id,
      adults: 2,
      children: 0,
      items: [{ ticketTypeId: ticketType.id, quantity: 2 }],
      customer: testCustomer("I"),
      source: "WEB",
      paymentMethod: "ONLINE",
    });

    const first = await confirmReservationPayment({ reservationId: reservation.id });
    const second = await confirmReservationPayment({ reservationId: reservation.id });

    expect(first.reservation.status).toBe("CONFIRMED");
    expect(second.reservation.status).toBe("CONFIRMED");
    expect(second.requiresManualReview).toBe(false);

    const history = await prisma.reservationStatusHistory.findMany({
      where: { reservationId: reservation.id, toStatus: "CONFIRMED" },
    });
    // Solo una transición a CONFIRMED, no dos, aunque se llamó dos veces.
    expect(history).toHaveLength(1);

    await cleanupShowtime(showtime.id);
  });

  it("no revive automáticamente una reserva expirada aunque llegue un pago aprobado tarde", async () => {
    const showtime = await createTestShowtime({ movieId: movie.id, capacity: 15 });

    const reservation = await createReservation({
      showtimeId: showtime.id,
      adults: 3,
      children: 0,
      items: [{ ticketTypeId: ticketType.id, quantity: 3 }],
      customer: testCustomer("J"),
      source: "WEB",
      paymentMethod: "ONLINE",
    });

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    await expireOverdueReservations();

    const result = await confirmReservationPayment({ reservationId: reservation.id });
    expect(result.requiresManualReview).toBe(true);
    expect(result.reservation.status).toBe("EXPIRED");

    await cleanupShowtime(showtime.id);
  });

  it("rechaza cancelar una reserva ya cancelada", async () => {
    const showtime = await createTestShowtime({ movieId: movie.id, capacity: 15 });
    const reservation = await createReservation({
      showtimeId: showtime.id,
      adults: 1,
      children: 0,
      items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
      customer: testCustomer("K"),
      source: "WEB",
      paymentMethod: "ONLINE",
    });

    await cancelReservation({ reservationId: reservation.id, reason: "Primera cancelación" });

    await expect(
      cancelReservation({ reservationId: reservation.id, reason: "Segunda cancelación" })
    ).rejects.toBeInstanceOf(InvalidReservationStateException);

    await cleanupShowtime(showtime.id);
  });
});
