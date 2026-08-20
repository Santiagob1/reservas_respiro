import { prisma } from "@/lib/prisma";
import type { ShowtimeStatus } from "@prisma/client";
import { zonedDateTimeToUtc, toDateTimeParts } from "@/lib/timezone";
import {
  CapacityBelowCommittedException,
  MovieHasReservationsException,
  ShowtimeNotFoundException,
  ValidationException,
} from "@/server/domain/errors";
import { getShowtimeAvailability } from "@/server/services/availability.service";

const ACTIVE_RESERVATION_STATUSES = [
  "PENDING_PAYMENT",
  "PAYMENT_APPROVED",
  "CONFIRMED",
  "CHECKED_IN",
] as const;

export interface ShowtimeInput {
  movieId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  capacity: number;
  status?: "DRAFT" | "PUBLISHED";
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
      ...(filters.publicOnly ? { status: "PUBLISHED" as never } : {}),
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
  const startsAt = zonedDateTimeToUtc(input.date, input.time);
  return prisma.showtime.create({
    data: {
      movieId: input.movieId,
      startsAt,
      capacity: input.capacity,
      status: input.status ?? "DRAFT",
    },
  });
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

  return prisma.showtime.update({ where: { id }, data });
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

export async function cancelShowtime(id: string) {
  await getShowtimeById(id);
  return prisma.showtime.update({ where: { id }, data: { status: "CANCELLED" } });
}

export async function countActiveReservations(showtimeId: string): Promise<number> {
  return prisma.reservation.count({
    where: { showtimeId, status: { in: [...ACTIVE_RESERVATION_STATUSES] } },
  });
}

function validateShowtimeInput(input: ShowtimeInput) {
  if (!input.movieId) throw new ValidationException("Selecciona una película.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new ValidationException("Fecha inválida.");
  if (!/^\d{2}:\d{2}$/.test(input.time)) throw new ValidationException("Hora inválida.");
  if (!input.capacity || input.capacity <= 0) {
    throw new ValidationException("La capacidad debe ser mayor a 0.");
  }
}
