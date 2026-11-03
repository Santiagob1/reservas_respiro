import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { listRooms } from "@/server/services/room.service";

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    return ok(await listRooms());
  } catch (error) {
    return handleApiError(error);
  }
}
