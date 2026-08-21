import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { deleteShowtime } from "@/server/services/showtime.service";
import { recordAudit } from "@/server/services/audit.service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = requireAdmin(req);
    const { id } = await params;
    await deleteShowtime(id);
    await recordAudit({
      adminUserId: admin.id,
      action: "DELETE_SHOWTIME",
      entityType: "Showtime",
      entityId: id,
    });
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
