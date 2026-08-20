import { ok, handleApiError } from "@/lib/api-response";
import { initiateOnlinePayment } from "@/server/services/payment.service";

// El segmento se llama "code" porque Next.js exige el mismo nombre de slug
// dinámico entre rutas hermanas bajo /api/reservations/[code]/*; el valor
// real que recibe este endpoint es el ID interno de la reserva (devuelto por
// POST /api/reservations), no el código humano CIN-XXXXX.
export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code: reservationId } = await params;
    const result = await initiateOnlinePayment(reservationId);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
