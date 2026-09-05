import type { Movie, Showtime } from "@prisma/client";
import type { AvailabilitySnapshot } from "@/server/services/availability.service";
import { formatCinemaDate, formatCinemaTime, hasPassed } from "@/lib/timezone";

export type PublicShowtimeState = "AVAILABLE" | "LOW_AVAILABILITY" | "SOLD_OUT" | "CANCELLED" | "FINISHED";

export interface PublicShowtimeDto {
  id: string;
  movie: {
    id: string;
    title: string;
    description: string;
    posterUrl: string | null;
    bannerUrl: string | null;
    durationMinutes: number;
    genre: string;
    rating: string;
    trailerUrl: string | null;
  };
  startsAt: string;
  dateKey: string; // YYYY-MM-DD en la zona horaria del cine
  dateLabel: string;
  dayAbbrev: string;
  dayNumber: string;
  monthAbbrev: string;
  timeLabel: string;
  capacity: number;
  available: number;
  state: PublicShowtimeState;
  isSpecial: boolean;
  specialAdImageUrl: string | null;
  specialMenuPrice: number | null;
  specialDescription: string | null;
}

export function toPublicShowtimeDto(
  showtime: Showtime & { movie: Movie },
  availability: AvailabilitySnapshot,
  lowAvailabilityThreshold: number
): PublicShowtimeDto {
  const state = deriveDisplayState(showtime, availability, lowAvailabilityThreshold);

  return {
    id: showtime.id,
    movie: {
      id: showtime.movie.id,
      title: showtime.movie.title,
      description: showtime.movie.description,
      posterUrl: showtime.movie.posterUrl,
      bannerUrl: showtime.movie.bannerUrl,
      durationMinutes: showtime.movie.durationMinutes,
      genre: showtime.movie.genre,
      rating: showtime.movie.rating,
      trailerUrl: showtime.movie.trailerUrl,
    },
    startsAt: showtime.startsAt.toISOString(),
    dateKey: formatCinemaDate(showtime.startsAt, "yyyy-MM-dd"),
    dateLabel: formatCinemaDate(showtime.startsAt),
    dayAbbrev: formatCinemaDate(showtime.startsAt, "EEE").replace(".", "").toUpperCase(),
    dayNumber: formatCinemaDate(showtime.startsAt, "d"),
    monthAbbrev: formatCinemaDate(showtime.startsAt, "MMM").replace(".", ""),
    timeLabel: formatCinemaTime(showtime.startsAt),
    capacity: showtime.capacity,
    available: availability.available,
    state,
    isSpecial: showtime.isSpecial,
    specialAdImageUrl: showtime.specialAdImageUrl,
    specialMenuPrice: showtime.specialMenuPrice,
    specialDescription: showtime.specialDescription,
  };
}

function deriveDisplayState(
  showtime: Showtime,
  availability: AvailabilitySnapshot,
  lowThreshold: number
): PublicShowtimeState {
  if (showtime.status === "CANCELLED") return "CANCELLED";
  if (showtime.status === "FINISHED" || hasPassed(showtime.startsAt)) return "FINISHED";
  // De cara al cliente, "cerramos reservas" se ve igual que "se agotó": en
  // ambos casos ya no se puede reservar, y "Cerrada" transmite que el sitio
  // tiene un problema en vez de generar el gancho de "se está agotando".
  if (showtime.status === "BOOKING_CLOSED" || availability.available <= 0) return "SOLD_OUT";
  // Últimos cupos desde que se vendió la mitad de la función (o el umbral
  // configurado, lo que sea más exigente), para generar sensación de urgencia.
  const halfSoldThreshold = Math.floor(availability.capacity / 2);
  if (availability.available <= Math.max(lowThreshold, halfSoldThreshold)) return "LOW_AVAILABILITY";
  return "AVAILABLE";
}
