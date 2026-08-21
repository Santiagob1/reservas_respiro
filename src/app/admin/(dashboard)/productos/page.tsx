"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/admin/formStyles";
import { formatCOP } from "@/components/public/wizard/types";

interface TicketType {
  id: string;
  name: string;
  description: string | null;
  price: number;
  includes: string[];
  active: boolean;
  sortOrder: number;
}

const EMPTY_FORM = { name: "", description: "", price: 0, includes: "", sortOrder: 0 };

export default function TicketTypesPage() {
  const [items, setItems] = useState<TicketType[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function load() {
    apiGet<TicketType[]>("/api/admin/ticket-types").then(setItems);
  }
  useEffect(load, []);

  function startEdit(t: TicketType) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      description: t.description ?? "",
      price: t.price,
      includes: t.includes.join(", "),
      sortOrder: t.sortOrder,
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
      name: form.name,
      description: form.description || null,
      price: Number(form.price),
      includes: form.includes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      sortOrder: Number(form.sortOrder),
    };
    try {
      if (editingId) await apiPatch(`/api/admin/ticket-types/${editingId}`, payload);
      else await apiPost("/api/admin/ticket-types", payload);
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos guardar el producto.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(t: TicketType) {
    await apiPatch(`/api/admin/ticket-types/${t.id}`, { active: !t.active });
    load();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div>
        <h1 className="font-display text-3xl text-cream">Productos</h1>
        <div className="mt-6 flex flex-col gap-3">
          {items.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-2xl border border-line bg-ink-card p-4">
              <div>
                <p className="font-display text-lg text-cream">{t.name}</p>
                <p className="text-sm text-gold">{formatCOP(t.price)}</p>
                {t.includes.length > 0 && <p className="text-xs text-muted">Incluye: {t.includes.join(", ")}</p>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => startEdit(t)}>
                  Editar
                </Button>
                <Button variant="secondary" size="sm" onClick={() => toggleActive(t)}>
                  {t.active ? "Desactivar" : "Activar"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex h-fit flex-col gap-4 rounded-2xl border border-line bg-ink-card p-5">
        <h2 className="font-display text-xl text-cream">{editingId ? "Editar producto" : "Nuevo producto"}</h2>

        <Field label="Nombre">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inputClass} />
        </Field>
        <Field label="Descripción">
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Precio (COP)">
          <input
            type="number"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Incluye (separado por comas)">
          <input value={form.includes} onChange={(e) => setForm({ ...form, includes: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Orden">
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
            className={inputClass}
          />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-3">
          {editingId && (
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={loading}>
            {editingId ? "Guardar cambios" : "Crear producto"}
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
