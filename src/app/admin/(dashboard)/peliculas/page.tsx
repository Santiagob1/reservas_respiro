"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/admin/formStyles";

interface Movie {
  id: string;
  title: string;
  description: string;
  posterUrl: string | null;
  bannerUrl: string | null;
  durationMinutes: number;
  genre: string;
  rating: string;
  trailerUrl: string | null;
  active: boolean;
}

const EMPTY_FORM = {
  title: "",
  description: "",
  posterUrl: "",
  durationMinutes: 100,
  genre: "",
  rating: "",
  trailerUrl: "",
};

export default function MoviesPage() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function load() {
    apiGet<Movie[]>("/api/admin/movies").then(setMovies);
  }
  useEffect(load, []);

  function startEdit(m: Movie) {
    setEditingId(m.id);
    setForm({
      title: m.title,
      description: m.description,
      posterUrl: m.posterUrl ?? "",
      durationMinutes: m.durationMinutes,
      genre: m.genre,
      rating: m.rating,
      trailerUrl: m.trailerUrl ?? "",
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const payload = {
      title: form.title,
      description: form.description,
      posterUrl: form.posterUrl || null,
      durationMinutes: Number(form.durationMinutes),
      genre: form.genre,
      rating: form.rating,
      trailerUrl: form.trailerUrl || null,
    };
    try {
      if (editingId) {
        await apiPatch(`/api/admin/movies/${editingId}`, payload);
      } else {
        await apiPost("/api/admin/movies", payload);
      }
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos guardar la película.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(m: Movie) {
    await apiPatch(`/api/admin/movies/${m.id}`, { active: !m.active });
    load();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div>
        <h1 className="font-display text-3xl text-cream">Películas</h1>
        <div className="mt-6 flex flex-col gap-3">
          {movies.map((m) => (
            <div
              key={m.id}
              className={`flex items-center justify-between rounded-2xl border p-4 ${m.active ? "border-line bg-ink-card" : "border-line/50 bg-ink-card/50"}`}
            >
              <div>
                <p className="font-display text-lg text-cream">{m.title}</p>
                <p className="text-xs text-muted">
                  {m.durationMinutes} min · {m.genre} · {m.rating}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => startEdit(m)}>
                  Editar
                </Button>
                <Button variant="secondary" onClick={() => toggleActive(m)}>
                  {m.active ? "Desactivar" : "Activar"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex h-fit flex-col gap-4 rounded-2xl border border-line bg-ink-card p-5">
        <h2 className="font-display text-xl text-cream">{editingId ? "Editar película" : "Nueva película"}</h2>

        <Field label="Título">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className={inputClass} />
        </Field>
        <Field label="Descripción">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
            rows={3}
            className={inputClass}
          />
        </Field>
        <Field label="Póster (URL)">
          <input value={form.posterUrl} onChange={(e) => setForm({ ...form, posterUrl: e.target.value })} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Duración (min)">
            <input
              type="number"
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Clasificación">
            <input value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} required className={inputClass} />
          </Field>
        </div>
        <Field label="Género">
          <input value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} required className={inputClass} />
        </Field>
        <Field label="Tráiler (URL, opcional)">
          <input value={form.trailerUrl} onChange={(e) => setForm({ ...form, trailerUrl: e.target.value })} className={inputClass} />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-3">
          {editingId && (
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={loading}>
            {editingId ? "Guardar cambios" : "Crear película"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-cream-dim">
      {label}
      {children}
    </label>
  );
}
