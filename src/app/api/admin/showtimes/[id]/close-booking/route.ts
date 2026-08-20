import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { closeBooking } from "@/server/services/showtime.service";
import { recordAudit } from "@/server/services/audit.service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = requireAdmin(req);
    const { id } = await params;
    const showtime = await closeBooking(id);
    await recordAudit({
      adminUserId: admin.id,
      action: "CLOSE_BOOKING",
      entityType: "Showtime",
      entityId: id,
    });
    return ok(showtime);
  } catch (error) {
    return handleApiError(error);
  }
}
