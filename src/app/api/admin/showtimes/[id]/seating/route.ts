import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { getShowtimeSeatingDetail } from "@/server/services/seating.service";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(req);
    const { id } = await params;
    const detail = await getShowtimeSeatingDetail(id);
    return ok(detail);
  } catch (error) {
    return handleApiError(error);
  }
}
