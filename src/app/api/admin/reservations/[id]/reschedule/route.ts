import { z } from "zod";
import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { rescheduleReservation } from "@/server/services/reservation.service";

const schema = z.object({ newShowtimeId: z.string().min(1) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = requireAdmin(req);
    const { id } = await params;
    const { newShowtimeId } = schema.parse(await req.json());
    const reservation = await rescheduleReservation({
      reservationId: id,
      newShowtimeId,
      adminUserId: admin.id,
    });
    return ok(reservation);
  } catch (error) {
    return handleApiError(error);
  }
}
