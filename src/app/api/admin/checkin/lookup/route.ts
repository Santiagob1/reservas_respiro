import { ok, fail, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { verifyQrToken } from "@/lib/qr";
import { getReservationByCode, getReservationById } from "@/server/services/reservation.service";
import { toReservationDto } from "@/server/dto/reservation.dto";

/** Vista previa de una reserva antes de confirmar el ingreso (no muta estado). */
export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const code = searchParams.get("code");

    let reservation;
    if (token) {
      const verified = verifyQrToken(token);
      if (!verified) return fail("INVALID_QR", "Este código QR no es válido.", 400);
      reservation = await getReservationById(verified.reservationId);
    } else if (code) {
      reservation = await getReservationByCode(code);
    } else {
      return fail("VALIDATION_ERROR", "Envía un token o un código.", 400);
    }

    return ok(toReservationDto(reservation));
  } catch (error) {
    return handleApiError(error);
  }
}
