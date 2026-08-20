import { ok, fail, handleApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getPaymentGateway } from "@/lib/payment-gateway";
import { formatCinemaDate, formatCinemaTime } from "@/lib/timezone";

/** Solo disponible cuando PAYMENT_PROVIDER=mock; alimenta la página de checkout simulado. */
export async function GET(_req: Request, { params }: { params: Promise<{ reservationId: string }> }) {
  try {
    if (getPaymentGateway().name !== "mock") {
      return fail("NOT_FOUND", "No encontrado.", 404);
    }
    const { reservationId } = await params;
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { showtime: { include: { movie: true } }, customer: true },
    });
    if (!reservation) return fail("RESERVATION_NOT_FOUND", "No encontramos esa reserva.", 404);

    return ok({
      code: reservation.code,
      status: reservation.status,
      movieTitle: reservation.showtime.movie.title,
      dateLabel: formatCinemaDate(reservation.showtime.startsAt),
      timeLabel: formatCinemaTime(reservation.showtime.startsAt),
      totalAmount: reservation.totalAmount,
      contact: reservation.customer.whatsapp,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
