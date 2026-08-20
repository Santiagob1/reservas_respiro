import { z } from "zod";
import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import {
  checkInByQrToken,
  checkInReservation,
  getReservationByCode,
} from "@/server/services/reservation.service";

const schema = z
  .object({
    token: z.string().optional(),
    code: z.string().optional(),
    force: z.boolean().optional(),
  })
  .refine((v) => v.token || v.code, "Debes enviar un token de QR o un código de reserva.");

export async function POST(req: Request) {
  try {
    const admin = requireAdmin(req);
    const body = schema.parse(await req.json());

    let reservation;
    if (body.token) {
      reservation = await checkInByQrToken({ token: body.token, adminUserId: admin.id, force: body.force });
    } else {
      const found = await getReservationByCode(body.code!);
      reservation = await checkInReservation({
        reservationId: found.id,
        adminUserId: admin.id,
        force: body.force,
      });
    }

    return ok(reservation);
  } catch (error) {
    return handleApiError(error);
  }
}
