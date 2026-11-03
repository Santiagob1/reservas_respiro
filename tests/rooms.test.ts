import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createReservation } from "@/server/services/reservation.service";
import { getShowtimeAvailability } from "@/server/services/availability.service";
import { getShowtimeSeatingState, getPhysicalRoomCapacity } from "@/server/services/seating.service";
import { createShowtime, updateShowtime } from "@/server/services/showtime.service";
import { InsufficientCapacityException, ValidationException } from "@/server/domain/errors";
import {
  createTestMovie,
  createTestTicketType,
  createTestShowtime,
  testCustomer,
  cleanupShowtime,
  cleanupMovie,
  cleanupTicketType,
  ROOM_1_ID,
  ROOM_2_ID,
} from "./helpers";

describe("Dos salas independientes (Sala 1: 4 parejas, Sala 2: 2 tríos)", () => {
  let movie: Awaited<ReturnType<typeof createTestMovie>>;
  let ticketType: Awaited<ReturnType<typeof createTestTicketType>>;
  const createdShowtimes: string[] = [];

  beforeAll(async () => {
    movie = await createTestMovie();
    ticketType = await createTestTicketType();
  });

  afterAll(async () => {
    for (const id of createdShowtimes) await cleanupShowtime(id);
    await cleanupMovie(movie.id);
    await cleanupTicketType(ticketType.id);
  });

  async function showtimeIn(roomId: string, capacity: number) {
    const showtime = await createTestShowtime({ movieId: movie.id, capacity, roomId });
    createdShowtimes.push(showtime.id);
    return showtime;
  }

  const reserve = (showtimeId: string, people: number, label: string) =>
    createReservation({
      showtimeId,
      adults: people,
      children: 0,
      items: [{ ticketTypeId: ticketType.id, quantity: people }],
      customer: testCustomer(label),
      source: "WEB",
      paymentMethod: "ONLINE",
    });

  it("la capacidad física de cada sala es 8/10 (Sala 1) y 6/8 (Sala 2)", async () => {
    expect(await getPhysicalRoomCapacity(ROOM_1_ID)).toEqual({ base: 8, max: 10 });
    expect(await getPhysicalRoomCapacity(ROOM_2_ID)).toEqual({ base: 6, max: 8 });
  });

  it("Sala 1: solo usa módulos pareja y se puede ampliar de 2 a 3 con las 2 auxiliares, luego se bloquea", async () => {
    const showtime = await showtimeIn(ROOM_1_ID, 10);

    const r1 = await reserve(showtime.id, 3, "S1-A"); // pareja + auxiliar 1
    const r2 = await reserve(showtime.id, 3, "S1-B"); // pareja + auxiliar 2
    for (const r of [r1, r2]) {
      expect(r.moduleAssignments).toHaveLength(1);
      expect(r.moduleAssignments[0].usesAuxiliary).toBe(true);
      expect(r.moduleAssignments[0].venueModule.type).toBe("COUPLE");
      expect(r.moduleAssignments[0].venueModule.roomId).toBe(ROOM_1_ID);
    }

    const seating = await getShowtimeSeatingState(showtime.id);
    expect(seating.remainingAux).toBe(0);

    // Con las 2 auxiliares gastadas ya no se puede ampliar ningún otro módulo a 3:
    // un nuevo grupo de 3 tiene que repartirse en DOS módulos pareja, sin auxiliar.
    const r3 = await reserve(showtime.id, 3, "S1-C");
    expect(r3.moduleAssignments).toHaveLength(2);
    expect(r3.moduleAssignments.every((a) => !a.usesAuxiliary)).toBe(true);

    // Eso consume los 4 asientos de las 2 parejas restantes: la sala queda llena (3+3+4 = 10).
    const availability = await getShowtimeAvailability(showtime.id);
    expect(availability.capacity).toBe(10);
    expect(availability.available).toBe(0);
    await expect(reserve(showtime.id, 1, "S1-D")).rejects.toBeInstanceOf(InsufficientCapacityException);
  });

  it("Sala 2: solo usa módulos trío y se puede ampliar de 3 a 4 con las 2 auxiliares (máximo 8)", async () => {
    const showtime = await showtimeIn(ROOM_2_ID, 8);

    const r1 = await reserve(showtime.id, 4, "S2-A"); // trío + auxiliar 1
    const r2 = await reserve(showtime.id, 4, "S2-B"); // trío + auxiliar 2
    for (const r of [r1, r2]) {
      expect(r.moduleAssignments).toHaveLength(1);
      expect(r.moduleAssignments[0].usesAuxiliary).toBe(true);
      expect(r.moduleAssignments[0].venueModule.type).toBe("TRIO");
      expect(r.moduleAssignments[0].venueModule.roomId).toBe(ROOM_2_ID);
    }

    const availability = await getShowtimeAvailability(showtime.id);
    expect(availability.capacity).toBe(8);
    expect(availability.available).toBe(0);
    await expect(reserve(showtime.id, 1, "S2-C")).rejects.toBeInstanceOf(InsufficientCapacityException);
  });

  it("Sala 2: un grupo de 4 no cabe si ya se gastaron las 2 auxiliares en otros módulos", async () => {
    const showtime = await showtimeIn(ROOM_2_ID, 8);
    // Un grupo de 6 ocupa ambos tríos sin auxiliar; ya no queda ningún módulo libre.
    await reserve(showtime.id, 6, "S2-big");
    await expect(reserve(showtime.id, 2, "S2-extra")).rejects.toBeInstanceOf(InsufficientCapacityException);
  });

  it("las funciones de cada sala son independientes aunque sean a la misma hora", async () => {
    const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const sala1 = await createTestShowtime({ movieId: movie.id, capacity: 10, roomId: ROOM_1_ID, startsAt });
    const sala2 = await createTestShowtime({ movieId: movie.id, capacity: 8, roomId: ROOM_2_ID, startsAt });
    createdShowtimes.push(sala1.id, sala2.id);

    // Llenar la Sala 1 por completo no afecta la disponibilidad de la Sala 2.
    await reserve(sala1.id, 3, "I-A");
    await reserve(sala1.id, 3, "I-B");
    await reserve(sala1.id, 2, "I-C");
    await reserve(sala1.id, 2, "I-D");
    expect((await getShowtimeAvailability(sala1.id)).available).toBe(0);
    expect((await getShowtimeAvailability(sala2.id)).available).toBe(8);
    await reserve(sala2.id, 4, "I-E");
    expect((await getShowtimeAvailability(sala2.id)).available).toBe(4);
  });

  it("al crear una función se valida la capacidad contra la sala elegida", async () => {
    await expect(
      createShowtime({ movieId: movie.id, roomId: ROOM_2_ID, date: "2030-01-10", time: "19:00", capacity: 10 })
    ).rejects.toBeInstanceOf(ValidationException);

    const ok = await createShowtime({ movieId: movie.id, roomId: ROOM_2_ID, date: "2030-01-10", time: "19:00", capacity: 8 });
    createdShowtimes.push(ok.id);
    expect(ok.roomId).toBe(ROOM_2_ID);
  });

  it("no se puede cambiar la sala de una función con reservas activas", async () => {
    const showtime = await showtimeIn(ROOM_1_ID, 10);
    await reserve(showtime.id, 2, "chg");
    await expect(updateShowtime(showtime.id, { roomId: ROOM_2_ID, capacity: 6 })).rejects.toMatchObject({
      code: "SHOWTIME_ROOM_CHANGE_BLOCKED",
    });
  });
});
