import { prisma } from "@/lib/prisma";
import { formatCinemaDate } from "@/lib/timezone";

const CONFIRMED_STATUSES = ["PAYMENT_APPROVED", "CONFIRMED", "CHECKED_IN"] as const;

export async function getReport(from: Date, to: Date) {
  const reservations = await prisma.reservation.findMany({
    where: {
      status: { in: [...CONFIRMED_STATUSES] },
      showtime: { startsAt: { gte: from, lte: to } },
    },
    include: { showtime: true, payments: true, items: true },
  });

  const byDay = new Map<
    string,
    { date: string; reservations: number; revenue: number; ticketsSold: number; occupancyPct: number; capacity: number }
  >();

  for (const r of reservations) {
    const key = formatCinemaDate(r.showtime.startsAt, "yyyy-MM-dd");
    const entry = byDay.get(key) ?? {
      date: key,
      reservations: 0,
      revenue: 0,
      ticketsSold: 0,
      occupancyPct: 0,
      capacity: r.showtime.capacity,
    };
    entry.reservations += 1;
    entry.revenue += r.totalAmount;
    entry.ticketsSold += r.adults + r.children;
    byDay.set(key, entry);
  }

  const paymentMethodTotals = new Map<string, number>();
  for (const r of reservations) {
    for (const p of r.payments.filter((p) => p.status === "APPROVED")) {
      paymentMethodTotals.set(p.method, (paymentMethodTotals.get(p.method) ?? 0) + p.amount);
    }
  }

  const totalRevenue = reservations.reduce((sum, r) => sum + r.totalAmount, 0);
  const totalTickets = reservations.reduce((sum, r) => sum + r.adults + r.children, 0);
  const avgTicket = reservations.length ? Math.round(totalRevenue / reservations.length) : 0;

  return {
    byDay: Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
    byPaymentMethod: Object.fromEntries(paymentMethodTotals),
    totals: {
      reservations: reservations.length,
      revenue: totalRevenue,
      ticketsSold: totalTickets,
      averageTicket: avgTicket,
    },
  };
}
