import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { getDashboardSummary } from "@/server/services/dashboard.service";

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const summary = await getDashboardSummary();
    return ok(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
