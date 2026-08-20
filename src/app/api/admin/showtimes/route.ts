import { z } from "zod";
import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { createShowtime, listShowtimes } from "@/server/services/showtime.service";
import { getAvailabilityForShowtimes } from "@/server/services/availability.service";
import { recordAudit } from "@/server/services/audit.service";

const createSchema = z.object({
  movieId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  capacity: z.number().int().positive(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const showtimes = await listShowtimes({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    const availability = await getAvailabilityForShowtimes(showtimes.map((s) => s.id));
    return ok(showtimes.map((s) => ({ ...s, availability: availability[s.id] })));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const admin = requireAdmin(req);
    const input = createSchema.parse(await req.json());
    const showtime = await createShowtime(input);
    await recordAudit({
      adminUserId: admin.id,
      action: "CREATE_SHOWTIME",
      entityType: "Showtime",
      entityId: showtime.id,
      details: input,
    });
    return ok(showtime, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
