import { ok, fail } from "@/lib/api-response";
import { expireOverdueReservations } from "@/server/services/reservation.service";

/**
 * Acepta dos formas de autenticación para cubrir distintos llamadores:
 * - Vercel Cron Jobs invoca con GET y header `Authorization: Bearer <CRON_SECRET>`.
 * - Llamadores externos (GitHub Actions, cron-job.org, curl manual) pueden usar
 *   POST con header `x-cron-secret: <CRON_SECRET>`.
 */
function isAuthorized(req: Request): boolean {
  if (!process.env.CRON_SECRET) return false;
  const bearer = req.headers.get("authorization");
  if (bearer === `Bearer ${process.env.CRON_SECRET}`) return true;
  const custom = req.headers.get("x-cron-secret");
  return custom === process.env.CRON_SECRET;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return fail("UNAUTHORIZED", "No autorizado.", 401);
  const expiredCount = await expireOverdueReservations();
  return ok({ expiredCount });
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return fail("UNAUTHORIZED", "No autorizado.", 401);
  const expiredCount = await expireOverdueReservations();
  return ok({ expiredCount });
}
