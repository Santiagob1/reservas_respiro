import { prisma } from "@/lib/prisma";

export async function createTestMovie() {
  return prisma.movie.create({
    data: {
      title: `Test Movie ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      description: "Película de prueba",
      durationMinutes: 100,
      genre: "Test",
      rating: "PG",
    },
  });
}

export async function createTestTicketType(price = 15000) {
  return prisma.ticketType.create({
    data: {
      name: `Test Ticket ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      price,
      includes: ["Entrada"],
    },
  });
}

export async function createTestShowtime(params: {
  movieId: string;
  capacity: number;
  startsAt?: Date;
  status?: "DRAFT" | "PUBLISHED";
  roomId?: string | null;
}) {
  return prisma.showtime.create({
    data: {
      movieId: params.movieId,
      roomId: params.roomId ?? null,
      capacity: params.capacity,
      startsAt: params.startsAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: params.status ?? "PUBLISHED",
    },
  });
}

/**
 * El layout físico de la sala (4 módulos pareja + 2 módulos trío) es un
 * recurso global, no algo que cada test cree/borre — igual que en producción,
 * las pruebas asumen que ya existe (creado por `prisma/seed.ts`) y solo lo
 * siembra aquí como red de seguridad si corren contra una base recién migrada.
 */
export const ROOM_1_ID = "room_sala_1";
export const ROOM_2_ID = "room_sala_2";

export async function ensureVenueModules() {
  for (const [id, name, sortOrder] of [
    [ROOM_1_ID, "Sala 1", 1],
    [ROOM_2_ID, "Sala 2", 2],
  ] as const) {
    await prisma.room.upsert({ where: { id }, update: {}, create: { id, name, sortOrder } });
  }
  const count = await prisma.venueModule.count();
  if (count > 0) return;
  await prisma.venueModule.createMany({
    data: [
      { type: "COUPLE", label: "Módulo pareja 1", baseCapacity: 2, sortOrder: 1, roomId: ROOM_1_ID },
      { type: "COUPLE", label: "Módulo pareja 2", baseCapacity: 2, sortOrder: 2, roomId: ROOM_1_ID },
      { type: "COUPLE", label: "Módulo pareja 3", baseCapacity: 2, sortOrder: 3, roomId: ROOM_1_ID },
      { type: "COUPLE", label: "Módulo pareja 4", baseCapacity: 2, sortOrder: 4, roomId: ROOM_1_ID },
      { type: "TRIO", label: "Módulo trío A", baseCapacity: 3, sortOrder: 5, roomId: ROOM_2_ID },
      { type: "TRIO", label: "Módulo trío B", baseCapacity: 3, sortOrder: 6, roomId: ROOM_2_ID },
    ],
  });
}

export async function createTestAdmin() {
  return prisma.adminUser.create({
    data: {
      email: `test-admin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.local`,
      passwordHash: "test-hash",
      name: "Admin de Prueba",
      role: "STAFF",
    },
  });
}

export async function cleanupAdmin(adminId: string) {
  await prisma.adminUser.delete({ where: { id: adminId } }).catch(() => {});
}

export function testCustomer(suffix: string) {
  return {
    fullName: `Cliente Prueba ${suffix}`,
    whatsapp: `300${String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0")}`,
    email: undefined,
  };
}

export async function cleanupShowtime(showtimeId: string) {
  const reservations = await prisma.reservation.findMany({
    where: { showtimeId },
    select: { id: true },
  });
  const reservationIds = reservations.map((r) => r.id);
  if (reservationIds.length) {
    await prisma.checkIn.deleteMany({ where: { reservationId: { in: reservationIds } } });
    await prisma.paymentTransaction.deleteMany({
      where: { payment: { reservationId: { in: reservationIds } } },
    });
    await prisma.payment.deleteMany({ where: { reservationId: { in: reservationIds } } });
    await prisma.notification.deleteMany({ where: { reservationId: { in: reservationIds } } });
    await prisma.reservationStatusHistory.deleteMany({
      where: { reservationId: { in: reservationIds } },
    });
    await prisma.reservationItem.deleteMany({ where: { reservationId: { in: reservationIds } } });
    await prisma.reservation.deleteMany({ where: { id: { in: reservationIds } } });
  }
  await prisma.showtime.delete({ where: { id: showtimeId } }).catch(() => {});
}

export async function cleanupMovie(movieId: string) {
  await prisma.movie.delete({ where: { id: movieId } }).catch(() => {});
}

export async function cleanupTicketType(ticketTypeId: string) {
  await prisma.ticketType.delete({ where: { id: ticketTypeId } }).catch(() => {});
}
