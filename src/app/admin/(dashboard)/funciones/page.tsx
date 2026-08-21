"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/admin/formStyles";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SeatingMap } from "@/components/admin/SeatingMap";

interface Movie {
  id: string;
  title: string;
  active: boolean;
}

interface ShowtimeRow {
  id: string;
  startsAt: string;
  capacity: number;
  status: string;
  weekPublished: boolean;
  movie: { id: string; title: string };
  availability: { available: number; confirmed: number; pending: number };
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicada",
  SOLD_OUT: "Agotada",
  BOOKING_CLOSED: "Reservas cerradas",
  CANCELLED: "Cancelada",
  FINISHED: "Finalizada",
};

export default function ShowtimesPage() {
  const [showtimes, setShowtimes] = useState<ShowtimeRow[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [form, setForm] = useState({ movieId: "", date: "", time: "19:00", capacity: 16 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function load() {
    const from = new Date().toISOString();
    apiGet<ShowtimeRow[]>(`/api/admin/showtimes?from=${from}`).then(setShowtimes);
    apiGet<Movie[]>("/api/admin/movies").then((all) => setMovies(all.filter((m) => m.active)));
  }
  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiPost("/api/admin/showtimes", {
        movieId: form.movieId,
        date: form.date,
        time: form.time,
        capacity: Number(form.capacity),
        status: "DRAFT",
      });
      setForm({ movieId: "", date: "", time: "19:00", capacity: 16 });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos crear la función.");
    } finally {
      setLoading(false);
    }
  }

  async function publish(id: string) {
    await apiPost("/api/admin/showtimes/publish-week", { showtimeIds: [id] });
    load();
  }

  async function closeBooking(id: string) {
    await apiPost(`/api/admin/showtimes/${id}/close-booking`, {});
    load();
  }

  async function cancelShowtime(id: string) {
    if (!window.confirm("¿Cancelar esta función? Las reservas asociadas no se eliminan y deberán gestionarse manualmente.")) return;
    await apiPost(`/api/admin/showtimes/${id}/cancel`, {});
    load();
  }

  async function deleteShowtime(id: string) {
    if (!window.confirm("¿Eliminar esta función por completo? Solo es posible si nunca tuvo reservas.")) return;
    setError(null);
    try {
      await apiPost(`/api/admin/showtimes/${id}/delete`, {});
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos eliminar la función.");
    }
  }

  const draftIds = showtimes.filter((s) => s.status === "DRAFT").map((s) => s.id);

  async function publishAllDrafts() {
    if (draftIds.length === 0) return;
    await apiPost("/api/admin/showtimes/publish-week", { showtimeIds: draftIds });
    load();
  }

  const groupedByDay = showtimes.reduce<Record<string, ShowtimeRow[]>>((acc, s) => {
    const dayKey = new Date(s.startsAt).toLocaleDateString("es-CO", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    (acc[dayKey] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-cream">Programación</h1>
        {draftIds.length > 0 && <Button onClick={publishAllDrafts}>Publicar semana ({draftIds.length})</Button>}
      </div>

      <form onSubmit={handleCreate} className="grid gap-4 rounded-2xl border border-line bg-ink-card p-5 sm:grid-cols-5">
        <select
          value={form.movieId}
          onChange={(e) => setForm({ ...form, movieId: e.target.value })}
          required
          className={inputClass}
        >
          <option value="">Película</option>
          {movies.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className={inputClass} />
        <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required className={inputClass} />
        <input
          type="number"
          value={form.capacity}
          onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
          required
          className={inputClass}
        />
        <Button type="submit" disabled={loading}>
          + Función
        </Button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-col gap-6">
        {Object.entries(groupedByDay).map(([day, rows]) => (
          <div key={day}>
            <h2 className="mb-3 text-xs uppercase tracking-widest text-gold">{day}</h2>
            <div className="flex flex-col gap-3">
              {rows.map((s) => (
                <div key={s.id} className="rounded-2xl border border-line bg-ink-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-display text-lg text-cream">{s.movie.title}</p>
                      <p className="text-sm text-cream-dim">
                        {new Date(s.startsAt).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}
                      </p>
                      <p className="text-xs text-muted">
                        {s.availability.confirmed} confirmadas · {s.availability.pending} pendientes ·{" "}
                        {s.availability.available} disponibles de {s.capacity}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={s.status === "DRAFT" ? "PENDING_PAYMENT" : "CONFIRMED"} />
                      <span className="text-xs text-muted">{STATUS_LABEL[s.status] ?? s.status}</span>
                      <Button variant="ghost" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                        {expandedId === s.id ? "Ocultar módulos" : "Ver módulos"}
                      </Button>
                      {s.status === "DRAFT" && (
                        <Button variant="secondary" onClick={() => publish(s.id)}>
                          Publicar
                        </Button>
                      )}
                      {s.status === "PUBLISHED" && (
                        <Button variant="secondary" onClick={() => closeBooking(s.id)}>
                          Cerrar reservas
                        </Button>
                      )}
                      {!["CANCELLED", "FINISHED"].includes(s.status) && (
                        <Button variant="ghost" onClick={() => cancelShowtime(s.id)}>
                          Cancelar
                        </Button>
                      )}
                      {s.availability.confirmed === 0 && s.availability.pending === 0 && (
                        <Button variant="ghost" onClick={() => deleteShowtime(s.id)}>
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </div>
                  {expandedId === s.id && (
                    <div className="mt-4">
                      <SeatingMap showtimeId={s.id} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {showtimes.length === 0 && <p className="text-sm text-muted">No hay funciones programadas todavía.</p>}
      </div>
    </div>
  );
}
