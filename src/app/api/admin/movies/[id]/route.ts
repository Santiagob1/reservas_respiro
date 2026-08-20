import { z } from "zod";
import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { updateMovie, setMovieActive } from "@/server/services/movie.service";
import { recordAudit } from "@/server/services/audit.service";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  posterUrl: z.string().url().optional().nullable(),
  bannerUrl: z.string().url().optional().nullable(),
  durationMinutes: z.number().int().positive().optional(),
  genre: z.string().min(1).optional(),
  rating: z.string().min(1).optional(),
  trailerUrl: z.string().url().optional().nullable(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = requireAdmin(req);
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    let movie;
    if (typeof body.active === "boolean") {
      movie = await setMovieActive(id, body.active);
    }
    const rest = { ...body };
    delete rest.active;
    if (Object.keys(rest).length > 0) {
      movie = await updateMovie(id, rest);
    }

    await recordAudit({
      adminUserId: admin.id,
      action: "UPDATE_MOVIE",
      entityType: "Movie",
      entityId: id,
      details: body,
    });

    return ok(movie);
  } catch (error) {
    return handleApiError(error);
  }
}
