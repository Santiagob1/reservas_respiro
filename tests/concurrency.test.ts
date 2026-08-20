import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createReservation } from "@/server/services/reservation.service";
import { getShowtimeAvailability } from "@/server/services/availability.service";
import { InsufficientCapacityException } from "@/server/domain/errors";
import {
  createTestMovie,
  createTestTicketType,
  createTestShowtime,
  testCustomer,
  cleanupShowtime,
  cleanupMovie,
  cleanupTicketType,
} from "./helpers";

describe("Concurrencia — anti-sobreventa (sección 20/99)", () => {
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

  it("con 15 cupos, dos solicitudes simultáneas de 10 no pueden sobrevender: solo una gana", async () => {
    const showtime = await createTestShowtime({ movieId: movie.id, capacity: 15 });

    const attempt = (label: string) =>
      createReservation({
        showtimeId: showtime.id,
        adults: 10,
        children: 0,
        items: [{ ticketTypeId: ticketType.id, quantity: 10 }],
        customer: testCustomer(label),
        source: "WEB",
        paymentMethod: "ONLINE",
      });

    const results = await Promise.allSettled([attempt("A"), attempt("B")]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientCapacityException);

    const availability = await getShowtimeAvailability(showtime.id);
    // 15 - 10 (la única reserva que ganó) = 5. Nunca debe quedar negativo ni en 15-20=-5.
    expect(availability.available).toBe(5);
    expect(availability.available).toBeGreaterThanOrEqual(0);

    await cleanupShowtime(showtime.id);
  });

  it("no permite reservar más cupos de los disponibles cuando ya hay una reserva confirmada", async () => {
    const showtime = await createTestShowtime({ movieId: movie.id, capacity: 5 });

    await createReservation({
      showtimeId: showtime.id,
      adults: 3,
      children: 0,
      items: [{ ticketTypeId: ticketType.id, quantity: 3 }],
      customer: testCustomer("C"),
      source: "WEB",
      paymentMethod: "ONLINE",
    });

    await expect(
      createReservation({
        showtimeId: showtime.id,
        adults: 3,
        children: 0,
        items: [{ ticketTypeId: ticketType.id, quantity: 3 }],
        customer: testCustomer("D"),
        source: "WEB",
        paymentMethod: "ONLINE",
      })
    ).rejects.toBeInstanceOf(InsufficientCapacityException);

    const availability = await getShowtimeAvailability(showtime.id);
    expect(availability.available).toBe(2);

    await cleanupShowtime(showtime.id);
  });

  it("distingue cupos confirmados de pendientes en la disponibilidad (sección 79)", async () => {
    const showtime = await createTestShowtime({ movieId: movie.id, capacity: 15 });

    await createReservation({
      showtimeId: showtime.id,
      adults: 8,
      children: 0,
      items: [{ ticketTypeId: ticketType.id, quantity: 8 }],
      customer: testCustomer("E"),
      source: "ADMIN_MANUAL",
      paymentMethod: "CASH",
    });

    const availability = await getShowtimeAvailability(showtime.id);
    expect(availability.pending).toBe(8); // efectivo queda PENDING_PAYMENT hasta marcarse pagada
    expect(availability.confirmed).toBe(0);
    expect(availability.available).toBe(7);

    await cleanupShowtime(showtime.id);
  });
});
