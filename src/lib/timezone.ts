import { fromZonedTime, toZonedTime, format } from "date-fns-tz";
import { es } from "date-fns/locale";

export const CINEMA_TIMEZONE = process.env.TIMEZONE || "America/Bogota";

/**
 * Convierte una fecha (YYYY-MM-DD) + hora (HH:mm) interpretadas en la zona
 * horaria del cine a un instante UTC para guardar en base de datos.
 */
export function zonedDateTimeToUtc(dateStr: string, timeStr: string): Date {
  const local = `${dateStr}T${timeStr}:00`;
  return fromZonedTime(local, CINEMA_TIMEZONE);
}

/** Instante actual, siempre calculado en el servidor (nunca confiar en el navegador). */
export function now(): Date {
  return new Date();
}

export function toCinemaTime(date: Date): Date {
  return toZonedTime(date, CINEMA_TIMEZONE);
}

export function formatCinemaDate(date: Date, pattern = "EEEE d 'de' MMMM"): string {
  const label = format(toZonedTime(date, CINEMA_TIMEZONE), pattern, {
    timeZone: CINEMA_TIMEZONE,
    locale: es,
  });
  return pattern.includes("EEEE") ? capitalize(label) : label;
}

export function formatCinemaTime(date: Date, pattern = "h:mm a"): string {
  return format(toZonedTime(date, CINEMA_TIMEZONE), pattern, {
    timeZone: CINEMA_TIMEZONE,
    locale: es,
  });
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatCinemaDateTime(date: Date): string {
  return format(toZonedTime(date, CINEMA_TIMEZONE), "yyyy-MM-dd'T'HH:mm:ssXXX", {
    timeZone: CINEMA_TIMEZONE,
  });
}

/** Descompone un instante UTC en fecha (YYYY-MM-DD) y hora (HH:mm) locales del cine. */
export function toDateTimeParts(date: Date): { date: string; time: string } {
  return {
    date: format(toZonedTime(date, CINEMA_TIMEZONE), "yyyy-MM-dd", { timeZone: CINEMA_TIMEZONE }),
    time: format(toZonedTime(date, CINEMA_TIMEZONE), "HH:mm", { timeZone: CINEMA_TIMEZONE }),
  };
}

/** true si el instante ya pasó respecto al reloj del servidor. */
export function hasPassed(date: Date): boolean {
  return date.getTime() < now().getTime();
}

/** Fecha de "hoy" (YYYY-MM-DD) en la zona horaria del cine, calculada en el servidor. */
export function getCinemaTodayKey(): string {
  return toDateTimeParts(now()).date;
}
