import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { cancelShowtime, countActiveReservations } from "@/server/services/showtime.service";
import { recordAudit } from "@/server/services/audit.service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = requireAdmin(req);
    const { id } = await params;
    const affectedReservations = await countActiveReservations(id);
    const showtime = await cancelShowtime(id);
    await recordAudit({
      adminUserId: admin.id,
      action: "CANCEL_SHOWTIME",
      entityType: "Showtime",
      entityId: id,
      details: { affectedReservations },
    });
    return ok({ showtime, affectedReservations });
  } catch (error) {
    return handleApiError(error);
  }
}
