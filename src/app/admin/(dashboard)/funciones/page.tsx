"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost, apiPatch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/admin/formStyles";
import { SeatingMap } from "@/components/admin/SeatingMap";
import { toDateTimeParts } from "@/lib/timezone";

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
  hasReservationHistory: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador (no visible aún)",
  PUBLISHED: "Publicada",
  SOLD_OUT: "Agotada",
  BOOKING_CLOSED: "Reservas cerradas",
  CANCELLED: "Cancelada",
  FINISHED: "Finalizada",
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "text-muted",
  PUBLISHED: "text-success",
  SOLD_OUT: "text-gold",
  BOOKING_CLOSED: "text-warning",
  CANCELLED: "text-danger",
  FINISHED: "text-muted",
};

export default function ShowtimesPage() {
  const [showtimes, setShowtimes] = useState<ShowtimeRow[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [form, setForm] = useState({ movieId: "", date: "", time: "19:00", capacity: 16 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ movieId: "", date: "", time: "", capacity: 16 });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);

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

  async function reactivateShowtime(id: string) {
    await apiPatch(`/api/admin/showtimes/${id}`, { status: "PUBLISHED" });
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

  function startEdit(s: ShowtimeRow) {
    const { date, time } = toDateTimeParts(new Date(s.startsAt));
    setEditingId(s.id);
    setEditError(null);
    setEditForm({ movieId: s.movie.id, date, time, capacity: s.capacity });
    // La película asignada puede haberse desactivado después de programar la función;
    // igual debe verse en el selector para no perderla al editar otro campo.
    setMovies((prev) => (prev.some((m) => m.id === s.movie.id) ? prev : [...prev, { ...s.movie, active: false }]));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditLoading(true);
    setEditError(null);
    try {
      await apiPatch(`/api/admin/showtimes/${editingId}`, {
        movieId: editForm.movieId,
        date: editForm.date,
        time: editForm.time,
        capacity: Number(editForm.capacity),
      });
      setEditingId(null);
      load();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "No pudimos guardar los cambios.");
    } finally {
      setEditLoading(false);
    }
  }

  const visibleShowtimes = showtimes.filter((s) => (showCancelled ? s.status === "CANCELLED" : s.status !== "CANCELLED"));
  const cancelledCount = showtimes.filter((s) => s.status === "CANCELLED").length;
  const draftIds = showtimes.filter((s) => s.status === "DRAFT").map((s) => s.id);

  async function publishAllDrafts() {
    if (draftIds.length === 0) return;
    await apiPost("/api/admin/showtimes/publish-week", { showtimeIds: draftIds });
    load();
  }

  const groupedByDay = visibleShowtimes.reduce<Record<string, ShowtimeRow[]>>((acc, s) => {
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
        <div className="flex items-center gap-2">
          {!showCancelled && draftIds.length > 0 && <Button onClick={publishAllDrafts}>Publicar semana ({draftIds.length})</Button>}
          <Button variant={showCancelled ? "secondary" : "ghost"} onClick={() => setShowCancelled((v) => !v)}>
            {showCancelled ? "Volver a la programación" : `Funciones canceladas (${cancelledCount})`}
          </Button>
        </div>
      </div>

      {!showCancelled && (
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
      )}
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-col gap-6">
        {Object.entries(groupedByDay).map(([day, rows]) => (
          <div key={day}>
            <h2 className="mb-3 text-xs uppercase tracking-widest text-gold">{day}</h2>
            <div className="flex flex-col gap-3">
              {rows.map((s) => {
                const { date: dateKey } = toDateTimeParts(new Date(s.startsAt));
                return (
                  <div key={s.id} className="rounded-2xl border border-line bg-ink-card p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-display text-lg text-cream">{s.movie.title}</p>
                        <p className="text-sm text-cream-dim">
                          {new Date(s.startsAt).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })} ·{" "}
                          <span className={STATUS_COLOR[s.status] ?? "text-muted"}>{STATUS_LABEL[s.status] ?? s.status}</span>
                        </p>
                        <p className="text-xs text-muted">
                          {s.availability.confirmed} confirmadas · {s.availability.pending} pendientes ·{" "}
                          {s.availability.available} disponibles de {s.capacity}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link href={`/admin/agenda?date=${dateKey}`}>
                          <Button variant="secondary" size="sm">
                            Ver reservas del día
                          </Button>
                        </Link>
                        {showCancelled ? (
                          <Button size="sm" onClick={() => reactivateShowtime(s.id)}>
                            Reactivar
                          </Button>
                        ) : (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                              {expandedId === s.id ? "Ocultar módulos" : "Módulos"}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => (editingId === s.id ? cancelEdit() : startEdit(s))}>
                              {editingId === s.id ? "Cerrar edición" : "Editar"}
                            </Button>
                            {s.status === "DRAFT" && (
                              <Button size="sm" onClick={() => publish(s.id)}>
                                Publicar
                              </Button>
                            )}
                            {s.status === "PUBLISHED" && (
                              <Button variant="ghost" size="sm" onClick={() => closeBooking(s.id)}>
                                Cerrar reservas
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => cancelShowtime(s.id)}>
                              Cancelar
                            </Button>
                          </>
                        )}
                        {s.hasReservationHistory ? (
                          <span
                            className="text-xs text-muted"
                            title="No se puede eliminar: esta función tiene reservas asociadas (incluye canceladas, que se conservan como historial)."
                          >
                            No eliminable
                          </span>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => deleteShowtime(s.id)}>
                            Eliminar
                          </Button>
                        )}
                      </div>
                    </div>
                    {editingId === s.id && (
                      <form onSubmit={saveEdit} className="mt-4 grid gap-3 rounded-xl border border-line bg-ink p-4 sm:grid-cols-5">
                        <select
                          value={editForm.movieId}
                          onChange={(e) => setEditForm({ ...editForm, movieId: e.target.value })}
                          required
                          className={inputClass}
                        >
                          {movies.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.title}
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={editForm.date}
                          onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                          required
                          className={inputClass}
                        />
                        <input
                          type="time"
                          value={editForm.time}
                          onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                          required
                          className={inputClass}
                        />
                        <input
                          type="number"
                          value={editForm.capacity}
                          onChange={(e) => setEditForm({ ...editForm, capacity: Number(e.target.value) })}
                          required
                          className={inputClass}
                        />
                        <div className="flex gap-2">
                          <Button type="submit" disabled={editLoading}>
                            Guardar
                          </Button>
                          <Button type="button" variant="secondary" onClick={cancelEdit}>
                            Cancelar
                          </Button>
                        </div>
                        {editError && <p className="text-sm text-danger sm:col-span-5">{editError}</p>}
                      </form>
                    )}
                    {expandedId === s.id && (
                      <div className="mt-4">
                        <SeatingMap showtimeId={s.id} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {visibleShowtimes.length === 0 && (
          <p className="text-sm text-muted">
            {showCancelled ? "No hay funciones canceladas." : "No hay funciones programadas todavía."}
          </p>
        )}
      </div>
    </div>
  );
}
