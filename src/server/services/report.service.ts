import { prisma } from "@/lib/prisma";
import { formatCinemaDate } from "@/lib/timezone";

/**
 * Reservas cuyo pago aprobado representa dinero realmente ingresado y
 * conservado. Se excluyen CANCELLED (la reserva se anuló; el pago, si quedó
 * marcado como aprobado, no se revierte automáticamente pero ya no es una
 * venta vigente), EXPIRED y REFUNDED (el dinero se devolvió).
 */
const REVENUE_STATUSES = ["PAYMENT_APPROVED", "CONFIRMED", "CHECKED_IN", "NO_SHOW"] as const;

/**
 * El reporte suma ingresos por la fecha en que se recibió cada pago
 * (payment.confirmedAt), no por la fecha de la función: casi todas las
 * reservas se pagan para una función futura, así que filtrar/agrupar por
 * `showtime.startsAt` dejaba el reporte en blanco (la función todavía no
 * había ocurrido y quedaba fuera del rango por defecto, que termina hoy).
 */
export async function getReport(from: Date, to: Date) {
  const payments = await prisma.payment.findMany({
    where: {
      status: "APPROVED",
      confirmedAt: { gte: from, lte: to },
      reservation: { status: { in: [...REVENUE_STATUSES] } },
    },
    include: { reservation: { include: { items: true } } },
  });

  const byDay = new Map<string, { date: string; reservations: Set<string>; revenue: number; ticketsSold: number }>();
  const paymentMethodTotals = new Map<string, number>();
  const seenReservations = new Set<string>();

  for (const p of payments) {
    const key = formatCinemaDate(p.confirmedAt!, "yyyy-MM-dd");
    const entry = byDay.get(key) ?? { date: key, reservations: new Set<string>(), revenue: 0, ticketsSold: 0 };
    entry.revenue += p.amount;
    entry.reservations.add(p.reservationId);
    if (!seenReservations.has(p.reservationId)) {
      entry.ticketsSold += p.reservation.adults + p.reservation.children;
    }
    byDay.set(key, entry);

    paymentMethodTotals.set(p.method, (paymentMethodTotals.get(p.method) ?? 0) + p.amount);
    seenReservations.add(p.reservationId);
  }

  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalTickets = Array.from(
    new Map(payments.map((p) => [p.reservationId, p.reservation.adults + p.reservation.children])).values()
  ).reduce((sum, n) => sum + n, 0);
  const avgTicket = seenReservations.size ? Math.round(totalRevenue / seenReservations.size) : 0;

  return {
    byDay: Array.from(byDay.values())
      .map((d) => ({ date: d.date, reservations: d.reservations.size, revenue: d.revenue, ticketsSold: d.ticketsSold }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    byPaymentMethod: Object.fromEntries(paymentMethodTotals),
    totals: {
      reservations: seenReservations.size,
      revenue: totalRevenue,
      ticketsSold: totalTickets,
      averageTicket: avgTicket,
    },
  };
}
