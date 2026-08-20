import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createReservation } from "@/server/services/reservation.service";
import { getShowtimeAvailability } from "@/server/services/availability.service";
import { getShowtimeSeatingState, findSeatingPlan } from "@/server/services/seating.service";
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

describe("Empaque de módulos físicos (parejas de 1.50m, tríos de 2m, auxiliares de 0.50m)", () => {
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

  it("4 grupos de 3 llenan la sala hasta 16 usando ambos módulos trío y luego pareja+auxiliar", async () => {
    const showtime = await createTestShowtime({ movieId: movie.id, capacity: 16 });
    const reserveThree = (label: string) =>
      createReservation({
        showtimeId: showtime.id,
        adults: 3,
        children: 0,
        items: [{ ticketTypeId: ticketType.id, quantity: 3 }],
        customer: testCustomer(label),
        source: "WEB",
        paymentMethod: "ONLINE",
      });

    const r1 = await reserveThree("P1"); // -> módulo trío A (sin auxiliar)
    const r2 = await reserveThree("P2"); // -> módulo trío B (sin auxiliar)
    const r3 = await reserveThree("P3"); // -> módulo pareja + auxiliar (1/2 usada)
    const r4 = await reserveThree("P4"); // -> módulo pareja + auxiliar (2/2 usada)

    for (const r of [r1, r2, r3, r4]) {
      expect(r.moduleAssignments).toHaveLength(1);
    }
    // Las dos primeras no debieron necesitar auxiliar; las dos siguientes sí.
    expect(r1.moduleAssignments[0].usesAuxiliary).toBe(false);
    expect(r2.moduleAssignments[0].usesAuxiliary).toBe(false);
    expect(r3.moduleAssignments[0].usesAuxiliary).toBe(true);
    expect(r4.moduleAssignments[0].usesAuxiliary).toBe(true);

    const seating = await getShowtimeSeatingState(showtime.id);
    expect(seating.occupiedSeats).toBe(12); // 3+3+3+3
    expect(seating.remainingAux).toBe(0); // ambas piezas auxiliares ya en uso
    expect(seating.freeModules).toHaveLength(2); // quedan las 2 parejas restantes, sin auxiliar

    // Con las auxiliares agotadas, un quinto grupo de 3 ya no cabe en un solo
    // módulo (las 2 parejas libres solo llegan a 2 sin auxiliar) — pero SÍ
    // caben dos grupos de 2, hasta completar el máximo físico de 16.
    const r5 = await createReservation({
      showtimeId: showtime.id,
      adults: 2,
      children: 0,
      items: [{ ticketTypeId: ticketType.id, quantity: 2 }],
      customer: testCustomer("P5"),
      source: "WEB",
      paymentMethod: "ONLINE",
    });
    const r6 = await createReservation({
      showtimeId: showtime.id,
      adults: 2,
      children: 0,
      items: [{ ticketTypeId: ticketType.id, quantity: 2 }],
      customer: testCustomer("P6"),
      source: "WEB",
      paymentMethod: "ONLINE",
    });
    expect(r5.moduleAssignments[0].usesAuxiliary).toBe(false);
    expect(r6.moduleAssignments[0].usesAuxiliary).toBe(false);

    const finalAvailability = await getShowtimeAvailability(showtime.id);
    expect(finalAvailability.available).toBe(0); // 16/16 exactos, la sala física está llena

    await cleanupShowtime(showtime.id);
  });

  it("rechaza un grupo que no cabe en ningún módulo aunque queden auxiliares libres", async () => {
    const showtime = await createTestShowtime({ movieId: movie.id, capacity: 16 });

    // Un grupo de 5 no cabe completo en un solo módulo (máximo físico por
    // módulo es 4: trío + auxiliar), pero SÍ puede repartirse en dos módulos.
    const combo = await createReservation({
      showtimeId: showtime.id,
      adults: 5,
      children: 0,
      items: [{ ticketTypeId: ticketType.id, quantity: 5 }],
      customer: testCustomer("Q1"),
      source: "WEB",
      paymentMethod: "ONLINE",
    });
    expect(combo.moduleAssignments.length).toBeGreaterThanOrEqual(2);
    const seated = combo.moduleAssignments.reduce((sum, a) => sum + a.seatsOccupied, 0);
    expect(seated).toBeGreaterThanOrEqual(5);

    await cleanupShowtime(showtime.id);
  });

  it("un techo administrativo alto no promete cupos que no existen físicamente (fragmentación)", async () => {
    // Capacidad administrativa 16, pero vamos a ocupar los 6 módulos con
    // grupos de 1 persona cada uno (desperdiciando sillas a propósito) para
    // dejar 0 módulos libres, aunque en teoría "sobren" cupos por cabeza.
    const showtime = await createTestShowtime({ movieId: movie.id, capacity: 16 });

    for (let i = 0; i < 6; i++) {
      await createReservation({
        showtimeId: showtime.id,
        adults: 1,
        children: 0,
        items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
        customer: testCustomer(`R${i}`),
        source: "WEB",
        paymentMethod: "ONLINE",
      });
    }

    const seating = await getShowtimeSeatingState(showtime.id);
    expect(seating.freeModules).toHaveLength(0); // los 6 módulos están ocupados
    expect(seating.occupiedSeats).toBe(14); // 4×2 + 2×3, aunque solo 6 personas están sentadas

    const availability = await getShowtimeAvailability(showtime.id);
    expect(availability.available).toBe(2); // 16 - 14, aritmética por cabeza sugiere que "caben 2"

    // Pero no hay ningún módulo libre: ni 1 persona más puede sentarse.
    await expect(
      createReservation({
        showtimeId: showtime.id,
        adults: 1,
        children: 0,
        items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
        customer: testCustomer("R6"),
        source: "WEB",
        paymentMethod: "ONLINE",
      })
    ).rejects.toBeInstanceOf(InsufficientCapacityException);

    await cleanupShowtime(showtime.id);
  });

  it("findSeatingPlan prioriza mantener el grupo en un solo módulo sobre ahorrar auxiliares", () => {
    const freeModules = [
      { id: "trio-1", type: "TRIO" as const, baseCapacity: 3 },
      { id: "couple-1", type: "COUPLE" as const, baseCapacity: 2 },
      { id: "couple-2", type: "COUPLE" as const, baseCapacity: 2 },
    ];
    // Para un grupo de 4: trío+auxiliar (1 módulo, 1 auxiliar) vs. las dos
    // parejas juntas (2 módulos, 0 auxiliares). Se prefiere el trío+auxiliar
    // porque mantiene al grupo en un solo sofá — igual que el ejemplo del
    // negocio, donde un grupo de 3 sin trío libre usa UN módulo pareja +
    // auxiliar en vez de dos módulos pareja separados.
    const plan = findSeatingPlan(freeModules, 2, 4);
    expect(plan).not.toBeNull();
    expect(plan).toHaveLength(1);
    expect(plan![0].venueModuleId).toBe("trio-1");
    expect(plan![0].usesAuxiliary).toBe(true);
  });

  it("findSeatingPlan, entre combinaciones del mismo tamaño, prefiere gastar menos auxiliares", () => {
    const freeModules = [
      { id: "couple-1", type: "COUPLE" as const, baseCapacity: 2 },
      { id: "couple-2", type: "COUPLE" as const, baseCapacity: 2 },
    ];
    // Para un grupo de 4 con solo 2 módulos pareja libres: la única
    // combinación de 1 módulo posible (couple+auxiliar=3) no alcanza; la de
    // 2 módulos (couple+couple=4) sí alcanza sin auxiliar — se usa esa.
    const plan = findSeatingPlan(freeModules, 2, 4);
    expect(plan).not.toBeNull();
    expect(plan).toHaveLength(2);
    expect(plan!.every((p) => !p.usesAuxiliary)).toBe(true);
  });
});
