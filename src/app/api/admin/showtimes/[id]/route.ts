import { z } from "zod";
import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { updateShowtime, countActiveReservations } from "@/server/services/showtime.service";
import { recordAudit } from "@/server/services/audit.service";

const patchSchema = z.object({
  movieId: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  capacity: z.number().int().positive().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "SOLD_OUT", "BOOKING_CLOSED", "CANCELLED", "FINISHED"]).optional(),
  confirmDespiteReservations: z.boolean().optional(),
  isSpecial: z.boolean().optional(),
  specialAdImageUrl: z.string().optional().nullable(),
  specialMenuPrice: z.number().int().positive().optional().nullable(),
  specialDescription: z.string().optional().nullable(),
  enabledTicketTypeIds: z.array(z.string()).optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(req);
    const { id } = await params;
    const activeReservations = await countActiveReservations(id);
    return ok({ activeReservations });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = requireAdmin(req);
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const patch = { ...body };
    delete patch.confirmDespiteReservations;

    const showtime = await updateShowtime(id, patch);

    await recordAudit({
      adminUserId: admin.id,
      action: "UPDATE_SHOWTIME",
      entityType: "Showtime",
      entityId: id,
      details: patch,
    });

    return ok(showtime);
  } catch (error) {
    return handleApiError(error);
  }
}
