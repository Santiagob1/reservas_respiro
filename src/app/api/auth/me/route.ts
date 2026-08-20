import { ok, fail } from "@/lib/api-response";
import { getAdminSession } from "@/lib/auth";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return fail("UNAUTHORIZED", "No has iniciado sesión.", 401);
  return ok(session);
}
