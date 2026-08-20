import { prisma } from "@/lib/prisma";
import { ValidationException } from "@/server/domain/errors";

export interface MovieInput {
  title: string;
  description: string;
  posterUrl?: string | null;
  bannerUrl?: string | null;
  durationMinutes: number;
  genre: string;
  rating: string;
  trailerUrl?: string | null;
}

export async function listMovies(opts: { onlyActive?: boolean } = {}) {
  return prisma.movie.findMany({
    where: opts.onlyActive ? { active: true } : undefined,
    orderBy: { createdAt: "desc" },
  });
}

export async function getMovieById(id: string) {
  return prisma.movie.findUnique({ where: { id } });
}

export async function createMovie(input: MovieInput) {
  validateMovieInput(input);
  return prisma.movie.create({ data: input });
}

export async function updateMovie(id: string, input: Partial<MovieInput>) {
  if (Object.keys(input).length === 0) {
    throw new ValidationException("No se enviaron cambios.");
  }
  return prisma.movie.update({ where: { id }, data: input });
}

export async function setMovieActive(id: string, active: boolean) {
  return prisma.movie.update({ where: { id }, data: { active } });
}

function validateMovieInput(input: MovieInput) {
  if (!input.title?.trim()) throw new ValidationException("El título de la película es obligatorio.");
  if (!input.description?.trim()) throw new ValidationException("La descripción es obligatoria.");
  if (!input.durationMinutes || input.durationMinutes <= 0) {
    throw new ValidationException("La duración debe ser mayor a 0 minutos.");
  }
  if (!input.genre?.trim()) throw new ValidationException("El género es obligatorio.");
  if (!input.rating?.trim()) throw new ValidationException("La clasificación es obligatoria.");
}
