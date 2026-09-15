"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Counter } from "@/components/public/wizard/Counter";
import { formatCOP } from "@/components/public/wizard/types";
import { inputClass } from "@/components/admin/formStyles";

interface ReservationDetailDto {
  id: string;
  code: string;
  status: string;
  totalAmount: number;
  adults: number;
  children: number;
  source: string;
  createdAt: string;
  expiresAt: string | null;
  cancelReason: string | null;
  customer: { fullName: string; whatsapp: string; email: string | null };
  showtime: { id: string; startsAt: string; movie: { title: string } };
  items: { ticketTypeId: string; ticketTypeName: string; quantity: number; unitPrice: number; total: number }[];
  payments: { id: string; method: string; status: string; amount: number; cashReference: string | null }[];
  checkIn: { checkedInAt: string } | null;
  moduleAssignments: {
    seatsOccupied: number;
    usesAuxiliary: boolean;
    venueModule: { label: string; type: string };
  }[];
}

interface ShowtimeOption {
  id: string;
  startsAt: string;
  status: string;
  movie: { title: string };
  availability: { available: number };
}

const EDITABLE_STATUSES = ["PAYMENT_APPROVED", "CONFIRMED", "CHECKED_IN"];
const RESCHEDULABLE_STATUSES = ["CONFIRMED", "EXPIRED"];

export default function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [reservation, setReservation] = useState<ReservationDetailDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [editingItems, setEditingItems] = useState(false);
  const [editAdults, setEditAdults] = useState(0);
  const [editChildren, setEditChildren] = useState(0);
  const [editQuantities, setEditQuantities] = useState<Record<string, number>>({});

  const [reschedulingOpen, setReschedulingOpen] = useState(false);
  const [showtimeOptions, setShowtimeOptions] = useState<ShowtimeOption[]>([]);
  const [newShowtimeId, setNewShowtimeId] = useState("");

  function load() {
    apiGet<ReservationDetailDto>(`/api/admin/reservations/${id}`).then(setReservation).catch(() => {});
  }

  useEffect(load, [id]);

  async function act(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await action();
      load();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Ocurrió un error.");
    } finally {
      setBusy(false);
    }
  }

  function startEditItems() {
    if (!reservation) return;
    setEditingItems(true);
    setMessage(null);
    setEditAdults(reservation.adults);
    setEditChildren(reservation.children);
    setEditQuantities(Object.fromEntries(reservation.items.map((i) => [i.ticketTypeId, i.quantity])));
  }

  async function saveEditItems() {
    const items = Object.entries(editQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }));
    await act(() =>
      apiPost(`/api/admin/reservations/${id}/edit-items`, {
        adults: editAdults,
        children: editChildren,
        items,
      })
    );
    setEditingItems(false);
  }

  function openReschedule() {
    if (!reservation) return;
    setReschedulingOpen(true);
    setMessage(null);
    setNewShowtimeId("");
    const from = new Date().toISOString();
    apiGet<ShowtimeOption[]>(`/api/admin/showtimes?from=${from}`).then((all) =>
      setShowtimeOptions(
        all.filter((s) => s.id !== reservation.showtime.id && !["CANCELLED", "FINISHED"].includes(s.status))
      )
    );
  }

  async function saveReschedule() {
    if (!newShowtimeId) return;
    await act(() => apiPost(`/api/admin/reservations/${id}/reschedule`, { newShowtimeId }));
    setReschedulingOpen(false);
  }

  if (!reservation) return <p className="text-muted">Cargando...</p>;
  const people = reservation.adults + reservation.children;
  const pendingPayment = reservation.payments.find((p) => p.status === "PENDING");
  const editItemsQty = Object.values(editQuantities).reduce((a, b) => a + b, 0);
  const editPeople = editAdults + editChildren;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href="/admin/reservas" className="text-sm text-gold hover:underline">
        ← Volver a reservas
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-cream">{reservation.code}</h1>
        <StatusBadge status={reservation.status} />
      </div>

      {message && <p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{message}</p>}

      {reservation.status === "EXPIRED" && (
        <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          Esta reserva expiró (el tiempo para pagar se agotó). Si el cliente sí pagó, usa &quot;Reactivar y
          confirmar&quot; — vuelve a verificar que haya cupo antes de confirmarla. Si ya no hay cupo en esta
          función, usa &quot;Reagendar&quot; para moverla a otra.
        </p>
      )}

      <div className="rounded-2xl border border-line bg-ink-card p-5">
        <p className="font-display text-xl text-cream">{reservation.showtime.movie.title}</p>
        <p className="text-sm text-cream-dim">
          {new Date(reservation.showtime.startsAt).toLocaleString("es-CO")}
        </p>
        <p className="mt-2 text-sm text-cream-dim">
          {reservation.customer.fullName} · {reservation.customer.whatsapp}
          {reservation.customer.email ? ` · ${reservation.customer.email}` : ""}
        </p>
        <p className="text-sm text-cream-dim">
          {people} persona{people === 1 ? "" : "s"} · Origen: {reservation.source}
        </p>

        {!editingItems ? (
          <>
            <ul className="mt-4 flex flex-col gap-1 text-sm text-cream-dim">
              {reservation.items.map((item, i) => (
                <li key={i} className="flex justify-between">
                  <span>
                    {item.quantity} × {item.ticketTypeName}
                  </span>
                  <span>{formatCOP(item.total)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-line pt-3">
              <span className="font-semibold text-cream">Total</span>
              <span className="font-display text-xl text-gold">{formatCOP(reservation.totalAmount)}</span>
            </div>
          </>
        ) : (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-line bg-ink p-4">
            <p className="text-xs text-cream-dim">
              Ajusta cuántas personas asistieron realmente (ej. reservaron 5, llegaron 4).
            </p>
            <div className="flex flex-col gap-2">
              <Counter label="Adultos" value={editAdults} max={20} onChange={setEditAdults} />
              <Counter label="Niños" value={editChildren} max={20} onChange={setEditChildren} />
            </div>
            <div className="flex flex-col gap-2">
              {reservation.items.map((item) => (
                <div key={item.ticketTypeId} className="flex items-center justify-between rounded-xl border border-line px-4 py-2">
                  <span className="text-sm text-cream">
                    {item.ticketTypeName} · {formatCOP(item.unitPrice)}
                  </span>
                  <Counter
                    label=""
                    value={editQuantities[item.ticketTypeId] ?? 0}
                    max={20}
                    onChange={(v) => setEditQuantities((prev) => ({ ...prev, [item.ticketTypeId]: v }))}
                  />
                </div>
              ))}
            </div>
            {editItemsQty !== editPeople && (
              <p className="text-xs text-warning">
                {editItemsQty} entradas para {editPeople} personas — deben coincidir.
              </p>
            )}
            <div className="flex gap-2">
              <Button disabled={busy || editItemsQty !== editPeople || editPeople === 0} onClick={saveEditItems}>
                Guardar cambios
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setEditingItems(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-ink-card p-5">
        <p className="text-sm font-semibold text-cream">Pagos</p>
        {reservation.payments.map((p) => (
          <p key={p.id} className="mt-1 text-sm text-cream-dim">
            {p.method} · {p.status} · {formatCOP(p.amount)}
            {p.cashReference ? ` · Ref: ${p.cashReference}` : ""}
          </p>
        ))}
      </div>

      {reservation.moduleAssignments.length > 0 && (
        <div className="rounded-2xl border border-line bg-ink-card p-5">
          <p className="text-sm font-semibold text-cream">Módulos asignados</p>
          {reservation.moduleAssignments.map((a, i) => (
            <p key={i} className="mt-1 text-sm text-cream-dim">
              {a.venueModule.label} ({a.venueModule.type === "COUPLE" ? "pareja" : "trío"}) · {a.seatsOccupied}{" "}
              persona{a.seatsOccupied === 1 ? "" : "s"}
              {a.usesAuxiliary ? " · con auxiliar" : ""}
            </p>
          ))}
        </div>
      )}

      {reservation.checkIn && (
        <p className="text-sm text-gold">
          Ingreso registrado el {new Date(reservation.checkIn.checkedInAt).toLocaleString("es-CO")}
        </p>
      )}

      {reschedulingOpen && (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-ink-card p-5">
          <p className="text-sm font-semibold text-cream">Reagendar a otra función</p>
          <select value={newShowtimeId} onChange={(e) => setNewShowtimeId(e.target.value)} className={inputClass}>
            <option value="">Selecciona una función</option>
            {showtimeOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.movie.title} · {new Date(s.startsAt).toLocaleString("es-CO")} · {s.availability.available} cupos
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button disabled={busy || !newShowtimeId} onClick={saveReschedule}>
              Confirmar cambio de función
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setReschedulingOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {reservation.status === "PENDING_PAYMENT" && pendingPayment && pendingPayment.method !== "ONLINE" && (
          <Button
            disabled={busy}
            onClick={() =>
              act(() => apiPost(`/api/admin/reservations/${id}/confirm-payment`, {}))
            }
          >
            Marcar como pagada
          </Button>
        )}

        {reservation.status === "EXPIRED" && (
          <Button
            disabled={busy}
            onClick={() => {
              if (window.confirm("¿El cliente sí pagó y quieres reactivar esta reserva? Se va a verificar que todavía haya cupo."))
                act(() => apiPost(`/api/admin/reservations/${id}/confirm-payment`, { force: true }));
            }}
          >
            Reactivar y confirmar
          </Button>
        )}

        {EDITABLE_STATUSES.includes(reservation.status) && !editingItems && (
          <Button variant="secondary" disabled={busy} onClick={startEditItems}>
            Editar cantidad de personas
          </Button>
        )}

        {RESCHEDULABLE_STATUSES.includes(reservation.status) && !reschedulingOpen && (
          <Button variant="secondary" disabled={busy} onClick={openReschedule}>
            Reagendar
          </Button>
        )}

        {["PENDING_PAYMENT", "PAYMENT_APPROVED", "CONFIRMED"].includes(reservation.status) && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              const reason = window.prompt("Motivo de la cancelación:");
              if (reason) act(() => apiPost(`/api/admin/reservations/${id}/cancel`, { reason }));
            }}
          >
            Cancelar reserva
          </Button>
        )}

        {reservation.status === "CONFIRMED" && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => act(() => apiPost(`/api/admin/checkin`, { code: reservation.code }))}
          >
            Registrar ingreso
          </Button>
        )}
      </div>
    </div>
  );
}
