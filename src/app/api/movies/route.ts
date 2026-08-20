import { ok, handleApiError } from "@/lib/api-response";
import { listMovies } from "@/server/services/movie.service";

export async function GET() {
  try {
    const movies = await listMovies({ onlyActive: true });
    return ok(movies);
  } catch (error) {
    return handleApiError(error);
  }
}
