import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { updateShowtime } from "@/server/services/showtime.service";
import { createReservation, rescheduleReservation } from "@/server/services/reservation.service";
import { getShowtimeAvailability } from "@/server/services/availability.service";
import { CapacityBelowCommittedException } from "@/server/domain/errors";
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
import { confirmReservationPayment } from "@/server/services/reservation.service";

describe("Guardas de negocio de funciones", () => {
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

  it("no permite bajar la capacidad por debajo de los cupos comprometidos (sección 43)", async () => {
    const showtime = await createTestShowtime({ movieId: movie.id, capacity: 15 });

    await createReservation({
      showtimeId: showtime.id,
      adults: 12,
      children: 0,
      items: [{ ticketTypeId: ticketType.id, quantity: 12 }],
      customer: testCustomer("L"),
      source: "WEB",
      paymentMethod: "ONLINE",
    });

    await expect(updateShowtime(showtime.id, { capacity: 10 })).rejects.toBeInstanceOf(
      CapacityBelowCommittedException
    );

    // Sí debe permitir bajar hasta el límite exacto comprometido.
    const updated = await updateShowtime(showtime.id, { capacity: 12 });
    expect(updated.capacity).toBe(12);

    await cleanupShowtime(showtime.id);
  });

  it("reagenda una reserva confirmada liberando la función original y ocupando la nueva (sección 31)", async () => {
    const showtimeA = await createTestShowtime({ movieId: movie.id, capacity: 15 });
    const showtimeB = await createTestShowtime({
      movieId: movie.id,
      capacity: 15,
      startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    });

    const reservation = await createReservation({
      showtimeId: showtimeA.id,
      adults: 3,
      children: 0,
      items: [{ ticketTypeId: ticketType.id, quantity: 3 }],
      customer: testCustomer("M"),
      source: "WEB",
      paymentMethod: "ONLINE",
    });
    await confirmReservationPayment({ reservationId: reservation.id });

    const rescheduled = await rescheduleReservation({
      reservationId: reservation.id,
      newShowtimeId: showtimeB.id,
      adminUserId: admin.id,
    });

    expect(rescheduled.showtimeId).toBe(showtimeB.id);
    expect(rescheduled.status).toBe("CONFIRMED");

    const availabilityA = await getShowtimeAvailability(showtimeA.id);
    const availabilityB = await getShowtimeAvailability(showtimeB.id);
    expect(availabilityA.available).toBe(15); // liberados
    expect(availabilityB.available).toBe(12); // ocupados en la nueva

    await cleanupShowtime(showtimeA.id);
    await cleanupShowtime(showtimeB.id);
  });
});
