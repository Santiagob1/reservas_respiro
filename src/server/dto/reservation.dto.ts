import type { ReservationWithDetails } from "@/server/services/reservation.service";
import { formatCinemaDate, formatCinemaTime } from "@/lib/timezone";

export function toReservationDto(reservation: ReservationWithDetails) {
  return {
    code: reservation.code,
    status: reservation.status,
    createdAt: reservation.createdAt.toISOString(),
    expiresAt: reservation.expiresAt?.toISOString() ?? null,
    cancelReason: reservation.cancelReason,
    customer: {
      fullName: reservation.customer.fullName,
      whatsapp: reservation.customer.whatsapp,
    },
    showtime: {
      id: reservation.showtime.id,
      movieTitle: reservation.showtime.movie.title,
      posterUrl: reservation.showtime.movie.posterUrl,
      dateLabel: formatCinemaDate(reservation.showtime.startsAt),
      timeLabel: formatCinemaTime(reservation.showtime.startsAt),
      status: reservation.showtime.status,
    },
    adults: reservation.adults,
    children: reservation.children,
    items: reservation.items.map((i) => ({
      name: i.ticketTypeName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      total: i.total,
    })),
    totalAmount: reservation.totalAmount,
    payments: reservation.payments.map((p) => ({
      method: p.method,
      status: p.status,
      amount: p.amount,
    })),
    hasQr: Boolean(reservation.qrToken),
    checkedIn: Boolean(reservation.checkIn),
    checkedInAt: reservation.checkIn?.checkedInAt.toISOString() ?? null,
  };
}
