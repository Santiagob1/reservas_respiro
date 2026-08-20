import { z } from "zod";
import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { getSettings, updateSettings, DEFAULT_SETTINGS } from "@/server/services/settings.service";
import { recordAudit } from "@/server/services/audit.service";

const keys = Object.keys(DEFAULT_SETTINGS) as (keyof typeof DEFAULT_SETTINGS)[];
const patchSchema = z.object(Object.fromEntries(keys.map((k) => [k, z.unknown().optional()])));

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const settings = await getSettings();
    return ok(settings);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = requireAdmin(req);
    const body = patchSchema.parse(await req.json());
    const settings = await updateSettings(body as never);
    await recordAudit({
      adminUserId: admin.id,
      action: "UPDATE_SETTINGS",
      entityType: "Setting",
      details: body,
    });
    return ok(settings);
  } catch (error) {
    return handleApiError(error);
  }
}
