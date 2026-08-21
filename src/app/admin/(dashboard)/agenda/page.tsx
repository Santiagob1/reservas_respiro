"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api-client";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SeatingMap } from "@/components/admin/SeatingMap";
import { formatCOP } from "@/components/public/wizard/types";

interface ShowtimeRow {
  id: string;
  startsAt: string;
  capacity: number;
  status: string;
  movie: { id: string; title: string };
  availability: { available: number; confirmed: number; pending: number };
}

interface ReservationListItem {
  id: string;
  code: string;
  status: string;
  totalAmount: number;
  adults: number;
  children: number;
  customer: { fullName: string; whatsapp: string };
  showtime: { id: string; startsAt: string; movie: { title: string } };
}

const WINDOW_SIZE = 7;
const ACTIVE_STATUSES = "PENDING_PAYMENT,PAYMENT_APPROVED,CONFIRMED,CHECKED_IN";

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function buildWindow(todayKey: string, offset: number) {
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

export default function AdminAgendaPage() {
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const [offset, setOffset] = useState(0);
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [showtimes, setShowtimes] = useState<ShowtimeRow[]>([]);
  const [reservations, setReservations] = useState<ReservationListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const days = useMemo(() => buildWindow(todayKey, offset), [todayKey, offset]);

  useEffect(() => {
    // Trae funciones de un rango amplio una sola vez, para pintar puntos en la tira de días.
    const from = new Date();
    from.setDate(from.getDate() - 3);
    apiGet<ShowtimeRow[]>(`/api/admin/showtimes?from=${from.toISOString()}`).then(setShowtimes);
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({
      from: `${selectedKey}T00:00:00`,
      to: `${selectedKey}T23:59:59`,
      status: ACTIVE_STATUSES,
      pageSize: "100",
    });
    apiGet<{ items: ReservationListItem[] }>(`/api/admin/reservations?${qs}`)
      .then((res) => setReservations(res.items))
      .finally(() => setLoading(false));
  }, [selectedKey]);

  const showtimesByDay = useMemo(() => {
    const map = new Map<string, ShowtimeRow[]>();
    for (const s of showtimes) {
      const key = toDateKey(new Date(s.startsAt));
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [showtimes]);

  const selectedShowtimes = showtimesByDay.get(selectedKey) ?? [];
  const totalPeopleToday = reservations.reduce((sum, r) => sum + r.adults + r.children, 0);
  const totalRevenueToday = reservations.reduce((sum, r) => sum + r.totalAmount, 0);

  function shiftWindow(newOffset: number) {
    setOffset(newOffset);
    setSelectedKey(buildWindow(todayKey, newOffset)[0].dateKey);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-cream">Agenda</h1>
        <p className="text-sm text-cream-dim">Prepara cada día según lo que tienes reservado.</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Días anteriores"
          onClick={() => shiftWindow(offset - WINDOW_SIZE)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-cream hover:border-gold hover:text-gold"
        >
          ‹
        </button>

        <div className="flex flex-1 gap-2 overflow-x-auto pb-2">
          {days.map((day) => {
            const active = day.dateKey === selectedKey;
            const hasShowtime = showtimesByDay.has(day.dateKey);
            return (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => setSelectedKey(day.dateKey)}
                className={`flex shrink-0 flex-col items-center rounded-2xl border px-4 py-3 transition-colors ${
                  active ? "border-gold bg-gold text-ink" : "border-line text-cream hover:border-gold-dim"
                }`}
              >
                <span className="text-[10px] uppercase tracking-wide">{day.dayAbbrev}</span>
                <span className="font-display text-xl leading-none">{day.dayNumber}</span>
                <span className="text-[10px] uppercase tracking-wide">{day.monthAbbrev}</span>
                {hasShowtime && (
                  <span className={`mt-1 h-1.5 w-1.5 rounded-full ${active ? "bg-ink" : "bg-gold"}`} />
                )}
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

      {selectedShowtimes.length === 0 ? (
        <p className="rounded-2xl border border-line bg-ink-card p-6 text-center text-muted">
          No hay función programada este día.
        </p>
      ) : (
        selectedShowtimes.map((s) => (
          <div key={s.id} className="rounded-2xl border border-line bg-ink-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-display text-xl text-cream">{s.movie.title}</p>
                <p className="text-sm text-gold">
                  {new Date(s.startsAt).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
              <StatusBadge status={s.status === "PUBLISHED" ? "CONFIRMED" : "PENDING_PAYMENT"} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
              <div>
                <p className="font-display text-2xl text-cream">{s.availability.confirmed}</p>
                <p className="text-xs text-muted">Confirmadas</p>
              </div>
              <div>
                <p className="font-display text-2xl text-warning">{s.availability.pending}</p>
                <p className="text-xs text-muted">Pendientes</p>
              </div>
              <div>
                <p className="font-display text-2xl text-cream">
                  {s.availability.available}/{s.capacity}
                </p>
                <p className="text-xs text-muted">Disponibles</p>
              </div>
            </div>
            <div className="mt-4">
              <SeatingMap showtimeId={s.id} />
            </div>
          </div>
        ))
      )}

      <div className="rounded-2xl border border-line bg-ink-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-cream">Reservas de este día</p>
          <p className="text-xs text-muted">
            {totalPeopleToday} persona{totalPeopleToday === 1 ? "" : "s"} · {formatCOP(totalRevenueToday)}
          </p>
        </div>

        {loading ? (
          <p className="mt-3 text-sm text-muted">Cargando...</p>
        ) : reservations.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No hay reservas activas para este día.</p>
        ) : (
          <div className="mt-3 flex flex-col divide-y divide-line">
            {reservations.map((r) => (
              <Link
                key={r.id}
                href={`/admin/reservas/${r.id}`}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm hover:text-gold"
              >
                <div>
                  <p className="font-medium text-cream">
                    {r.customer.fullName} <span className="text-xs text-muted">({r.code})</span>
                  </p>
                  <p className="text-xs text-muted">
                    {r.customer.whatsapp} · {r.adults + r.children} persona{r.adults + r.children === 1 ? "" : "s"}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
