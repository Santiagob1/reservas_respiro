import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { getReport } from "@/server/services/report.service";

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from")
      ? new Date(searchParams.get("from")!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : new Date();

    const report = await getReport(from, to);
    return ok(report);
  } catch (error) {
    return handleApiError(error);
  }
}
