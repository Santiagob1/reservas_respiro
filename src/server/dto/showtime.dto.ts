import type { Movie, Showtime } from "@prisma/client";
import type { AvailabilitySnapshot } from "@/server/services/availability.service";
import { formatCinemaDate, formatCinemaTime, hasPassed } from "@/lib/timezone";

export type PublicShowtimeState =
  | "AVAILABLE"
  | "LOW_AVAILABILITY"
  | "SOLD_OUT"
  | "CANCELLED"
  | "FINISHED"
  | "BOOKING_CLOSED";

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
  };
}

function deriveDisplayState(
  showtime: Showtime,
  availability: AvailabilitySnapshot,
  lowThreshold: number
): PublicShowtimeState {
  if (showtime.status === "CANCELLED") return "CANCELLED";
  if (showtime.status === "BOOKING_CLOSED") return "BOOKING_CLOSED";
  if (showtime.status === "FINISHED" || hasPassed(showtime.startsAt)) return "FINISHED";
  if (availability.available <= 0) return "SOLD_OUT";
  if (availability.available <= lowThreshold) return "LOW_AVAILABILITY";
  return "AVAILABLE";
}
