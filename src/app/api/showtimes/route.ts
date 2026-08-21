import { ok, handleApiError } from "@/lib/api-response";
import { listPublicShowtimes } from "@/server/services/public-showtime.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dtos = await listPublicShowtimes();
    return ok(dtos);
  } catch (error) {
    return handleApiError(error);
  }
}
