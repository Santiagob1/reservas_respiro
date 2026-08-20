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
}) {
  return prisma.showtime.create({
    data: {
      movieId: params.movieId,
      capacity: params.capacity,
      startsAt: params.startsAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: params.status ?? "PUBLISHED",
    },
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
