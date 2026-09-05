import { z } from "zod";
import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { createShowtime, listShowtimes } from "@/server/services/showtime.service";
import { getAvailabilityForShowtimes } from "@/server/services/availability.service";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/services/audit.service";

const createSchema = z.object({
  movieId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  capacity: z.number().int().positive(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  isSpecial: z.boolean().optional(),
  specialAdImageUrl: z.string().optional().nullable(),
  specialMenuPrice: z.number().int().positive().optional().nullable(),
  specialDescription: z.string().optional().nullable(),
  enabledTicketTypeIds: z.array(z.string()).optional(),
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
    const reservationCounts = await prisma.reservation.groupBy({
      by: ["showtimeId"],
      where: { showtimeId: { in: showtimes.map((s) => s.id) } },
      _count: { _all: true },
    });
    const countByShowtime = new Map(reservationCounts.map((r) => [r.showtimeId, r._count._all]));
    const overrides = await prisma.showtimeTicketType.findMany({
      where: { showtimeId: { in: showtimes.map((s) => s.id) } },
    });
    const overridesByShowtime = new Map<string, string[]>();
    for (const o of overrides) {
      const list = overridesByShowtime.get(o.showtimeId) ?? [];
      list.push(o.ticketTypeId);
      overridesByShowtime.set(o.showtimeId, list);
    }

    return ok(
      showtimes.map((s) => ({
        ...s,
        availability: availability[s.id],
        hasReservationHistory: (countByShowtime.get(s.id) ?? 0) > 0,
        // null = sin override configurado (aplica el comportamiento por defecto: todos habilitados).
        enabledTicketTypeIds: overridesByShowtime.get(s.id) ?? null,
      }))
    );
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
