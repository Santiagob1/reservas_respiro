import { z } from "zod";
import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { publishWeek } from "@/server/services/showtime.service";
import { recordAudit } from "@/server/services/audit.service";

const schema = z.object({ showtimeIds: z.array(z.string().min(1)).min(1) });

export async function POST(req: Request) {
  try {
    const admin = requireAdmin(req);
    const { showtimeIds } = schema.parse(await req.json());
    const result = await publishWeek(showtimeIds);
    await recordAudit({
      adminUserId: admin.id,
      action: "PUBLISH_WEEK",
      entityType: "Showtime",
      details: { showtimeIds },
    });
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
