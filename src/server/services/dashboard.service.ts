import { prisma } from "@/lib/prisma";
import { CINEMA_TIMEZONE, formatCinemaDate, formatCinemaTime } from "@/lib/timezone";
import { getShowtimeAvailability } from "@/server/services/availability.service";
import { toZonedTime, fromZonedTime, format } from "date-fns-tz";

/** Reservas cuyo pago aprobado sigue representando una venta vigente (ver report.service.ts). */
const REVENUE_STATUSES = ["PAYMENT_APPROVED", "CONFIRMED", "CHECKED_IN", "NO_SHOW"] as const;

function startOfCinemaDay(reference = new Date()): Date {
  const local = format(toZonedTime(reference, CINEMA_TIMEZONE), "yyyy-MM-dd", {
    timeZone: CINEMA_TIMEZONE,
  });
  return fromZonedTime(`${local}T00:00:00`, CINEMA_TIMEZONE);
}

function endOfCinemaDay(reference = new Date()): Date {
  const local = format(toZonedTime(reference, CINEMA_TIMEZONE), "yyyy-MM-dd", {
    timeZone: CINEMA_TIMEZONE,
  });
  return fromZonedTime(`${local}T23:59:59`, CINEMA_TIMEZONE);
}

export async function getTodayShowtimes() {
  const from = startOfCinemaDay();
  const to = endOfCinemaDay();

  const showtimes = await prisma.showtime.findMany({
    where: { startsAt: { gte: from, lte: to } },
    include: { movie: true },
    orderBy: { startsAt: "asc" },
  });

  return Promise.all(
    showtimes.map(async (showtime) => {
      const availability = await getShowtimeAvailability(showtime.id);

      const [revenueAgg, pendingCount, reservationsCount] = await Promise.all([
        prisma.payment.aggregate({
          where: {
            status: "APPROVED",
            reservation: { showtimeId: showtime.id, status: { in: [...REVENUE_STATUSES] } },
          },
          _sum: { amount: true },
        }),
        prisma.reservation.count({
          where: { showtimeId: showtime.id, status: "PENDING_PAYMENT" },
        }),
        prisma.reservation.count({
          where: {
            showtimeId: showtime.id,
            status: { in: ["PAYMENT_APPROVED", "CONFIRMED", "CHECKED_IN"] },
          },
        }),
      ]);

      return {
        id: showtime.id,
        movieTitle: showtime.movie.title,
        dateLabel: formatCinemaDate(showtime.startsAt),
        timeLabel: formatCinemaTime(showtime.startsAt),
        status: showtime.status,
        capacity: availability.capacity,
        confirmed: availability.confirmed,
        pending: availability.pending,
        available: availability.available,
        occupancyPct: availability.capacity
          ? Math.round(((availability.confirmed + availability.pending) / availability.capacity) * 100)
          : 0,
        reservationsCount,
        pendingPaymentsCount: pendingCount,
        revenue: revenueAgg._sum.amount ?? 0,
      };
    })
  );
}

export async function getDashboardSummary() {
  const todayShowtimes = await getTodayShowtimes();

  const [totalMovies, totalUpcomingShowtimes, totalPendingPayments] = await Promise.all([
    prisma.movie.count({ where: { active: true } }),
    prisma.showtime.count({ where: { status: "PUBLISHED", startsAt: { gte: new Date() } } }),
    prisma.reservation.count({ where: { status: "PENDING_PAYMENT" } }),
  ]);

  return {
    today: todayShowtimes,
    totals: { totalMovies, totalUpcomingShowtimes, totalPendingPayments },
  };
}
