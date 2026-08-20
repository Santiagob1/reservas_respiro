import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { getReservationById } from "@/server/services/reservation.service";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(req);
    const { id } = await params;
    const reservation = await getReservationById(id);
    return ok(reservation);
  } catch (error) {
    return handleApiError(error);
  }
}
