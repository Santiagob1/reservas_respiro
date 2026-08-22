"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PublicShowtimeDto } from "@/server/dto/showtime.dto";

const STATE_LABEL: Record<PublicShowtimeDto["state"], { label: string; tone: string }> = {
  AVAILABLE: { label: "Disponible", tone: "text-success" },
  LOW_AVAILABILITY: { label: "¡Se está llenando!", tone: "text-warning" },
  SOLD_OUT: { label: "Agotado", tone: "text-danger" },
  CANCELLED: { label: "Cancelada", tone: "text-danger" },
  FINISHED: { label: "Finalizada", tone: "text-muted" },
};

const WINDOW_SIZE = 7;

interface DayPill {
  dateKey: string;
  dayAbbrev: string;
  dayNumber: string;
  monthAbbrev: string;
  isToday: boolean;
}

function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildWindow(todayKey: string, offset: number): DayPill[] {
  const base = parseDateKey(todayKey);
  const dayFmt = new Intl.DateTimeFormat("es-CO", { weekday: "short" });
  const monthFmt = new Intl.DateTimeFormat("es-CO", { month: "short" });

  return Array.from({ length: WINDOW_SIZE }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + offset + i);
    return {
      dateKey: toDateKey(d),
      dayAbbrev: dayFmt.format(d).replace(".", "").toUpperCase(),
      dayNumber: String(d.getDate()),
      monthAbbrev: monthFmt.format(d).replace(".", ""),
      isToday: offset + i === 0,
    };
  });
}

export function AgendaPicker({
  showtimes,
  todayKey,
}: {
  showtimes: PublicShowtimeDto[];
  todayKey: string;
}) {
  const [offset, setOffset] = useState(0);
  const [selectedKey, setSelectedKey] = useState(todayKey);

  const days = useMemo(() => buildWindow(todayKey, offset), [todayKey, offset]);
  const byDate = useMemo(() => {
    const map = new Map<string, PublicShowtimeDto>();
    for (const s of showtimes) map.set(s.dateKey, s);
    return map;
  }, [showtimes]);

  const selectedShowtime = byDate.get(selectedKey);

  function shiftWindow(newOffset: number) {
    setOffset(newOffset);
    setSelectedKey(buildWindow(todayKey, newOffset)[0].dateKey);
  }

  return (
    <div id="agenda" className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Días anteriores"
          disabled={offset <= 0}
          onClick={() => shiftWindow(Math.max(0, offset - WINDOW_SIZE))}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-cream hover:border-gold hover:text-gold disabled:opacity-30"
        >
          ‹
        </button>

        <div className="flex flex-1 gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Selecciona una fecha">
          {days.map((day) => {
            const active = day.dateKey === selectedKey;
            const hasFunction = byDate.has(day.dateKey);
            return (
              <button
                key={day.dateKey}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedKey(day.dateKey)}
                className={`flex shrink-0 flex-col items-center rounded-2xl border px-4 py-3 transition-colors ${
                  active
                    ? "border-gold bg-gold text-ink"
                    : hasFunction
                      ? "border-line text-cream hover:border-gold-dim"
                      : "border-line/60 text-muted hover:border-gold-dim"
                }`}
              >
                <span className="text-[10px] uppercase tracking-wide">{day.dayAbbrev}</span>
                <span className="font-display text-xl leading-none">{day.dayNumber}</span>
                <span className="text-[10px] uppercase tracking-wide">{day.monthAbbrev}</span>
                {day.isToday && <span className="mt-1 text-[9px] uppercase tracking-wide">Hoy</span>}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-label="Más días"
          onClick={() => shiftWindow(offset + WINDOW_SIZE)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-cream hover:border-gold hover:text-gold"
        >
          ›
        </button>
      </div>

      {selectedShowtime ? (
        <FunctionCard showtime={selectedShowtime} />
      ) : (
        <div className="rounded-2xl border border-line bg-ink-card p-8 text-center">
          <p className="text-cream-dim">No hay función programada para este día.</p>
          <p className="mt-1 text-sm text-muted">Elige otra fecha en la agenda.</p>
        </div>
      )}
    </div>
  );
}

function FunctionCard({ showtime }: { showtime: PublicShowtimeDto }) {
  const state = STATE_LABEL[showtime.state];
  const reservable = showtime.state === "AVAILABLE" || showtime.state === "LOW_AVAILABILITY";
  const soldOut = showtime.state === "SOLD_OUT";
  const low = showtime.state === "LOW_AVAILABILITY";

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-line bg-ink-card p-5 sm:flex-row">
      <div className="relative h-48 w-full shrink-0 overflow-hidden rounded-xl bg-ink-soft sm:h-auto sm:w-32">
        {showtime.movie.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={showtime.movie.posterUrl}
            alt={`Póster de ${showtime.movie.title}`}
            className={`h-full w-full object-cover transition-opacity ${soldOut ? "opacity-30" : ""}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted">Sin imagen</div>
        )}
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="-rotate-12 rounded border-2 border-danger bg-ink/90 px-4 py-1.5 text-sm font-black uppercase tracking-widest text-danger shadow-lg">
              Agotado
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between gap-3">
        <div>
          <p className="text-xs text-gold">{showtime.dateLabel} · {showtime.timeLabel}</p>
          <h3 className="font-display text-2xl text-cream">{showtime.movie.title}</h3>
          <p className="text-sm text-cream-dim">
            {showtime.movie.durationMinutes} min · {showtime.movie.genre} · {showtime.movie.rating}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-sm font-semibold ${state.tone}`}>{state.label}</p>
            {reservable && (
              <p className={`text-xs ${low ? "font-semibold text-warning" : "text-muted"}`}>
                {low ? `¡Quedan solo ${showtime.available} entradas!` : `${showtime.available} cupos disponibles`}
              </p>
            )}
          </div>

          {reservable ? (
            <Link
              href={`/reservar?showtimeId=${showtime.id}`}
              className="rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-gold-soft"
            >
              Reservar
            </Link>
          ) : (
            <span className="rounded-full border border-line px-6 py-2.5 text-sm text-muted">No disponible</span>
          )}
        </div>
      </div>
    </div>
  );
}
