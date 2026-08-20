import { z } from "zod";
import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { cancelReservation } from "@/server/services/reservation.service";

const schema = z.object({ reason: z.string().min(3) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = requireAdmin(req);
    const { id } = await params;
    const { reason } = schema.parse(await req.json());
    const reservation = await cancelReservation({ reservationId: id, reason, adminUserId: admin.id });
    return ok(reservation);
  } catch (error) {
    return handleApiError(error);
  }
}
