import { z } from "zod";
import { ok, fail, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { confirmReservationPayment } from "@/server/services/reservation.service";

const schema = z.object({
  cashReference: z.string().optional(),
});

/** "Marcar como pagada" — para pagos en efectivo, transferencia u otros registrados por admin. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = requireAdmin(req);
    const { id } = await params;
    const body = schema.parse(await req.json().catch(() => ({})));

    const { reservation, requiresManualReview } = await confirmReservationPayment({
      reservationId: id,
      confirmedById: admin.id,
      cashReference: body.cashReference,
    });

    if (requiresManualReview) {
      return fail(
        "RESERVATION_EXPIRED",
        "Esta reserva ya no está pendiente (expiró o fue cancelada). El pago quedó registrado pero requiere revisión manual antes de confirmar, ya que el cupo pudo haberse liberado.",
        409
      );
    }

    return ok(reservation);
  } catch (error) {
    return handleApiError(error);
  }
}
