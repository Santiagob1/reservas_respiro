import { ok } from "@/lib/api-response";
import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  await clearSessionCookie();
  return ok({ loggedOut: true });
}
