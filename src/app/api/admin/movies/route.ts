import { z } from "zod";
import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/require-admin";
import { createMovie, listMovies } from "@/server/services/movie.service";
import { recordAudit } from "@/server/services/audit.service";

const movieSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  posterUrl: z.string().url().optional().nullable(),
  bannerUrl: z.string().url().optional().nullable(),
  durationMinutes: z.number().int().positive(),
  genre: z.string().min(1),
  rating: z.string().min(1),
  trailerUrl: z.string().url().optional().nullable(),
});

export async function GET() {
  try {
    const movies = await listMovies();
    return ok(movies);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const admin = requireAdmin(req);
    const input = movieSchema.parse(await req.json());
    const movie = await createMovie(input);
    await recordAudit({
      adminUserId: admin.id,
      action: "CREATE_MOVIE",
      entityType: "Movie",
      entityId: movie.id,
      details: { title: movie.title },
    });
    return ok(movie, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
