"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import { formatCOP } from "@/components/public/wizard/types";

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
  items: { ticketTypeName: string; quantity: number; unitPrice: number; total: number }[];
  payments: { id: string; method: string; status: string; amount: number; cashReference: string | null }[];
  checkIn: { checkedInAt: string } | null;
}

export default function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [reservation, setReservation] = useState<ReservationDetailDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  if (!reservation) return <p className="text-muted">Cargando...</p>;
  const people = reservation.adults + reservation.children;
  const pendingPayment = reservation.payments.find((p) => p.status === "PENDING");

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

      {reservation.checkIn && (
        <p className="text-sm text-gold">
          Ingreso registrado el {new Date(reservation.checkIn.checkedInAt).toLocaleString("es-CO")}
        </p>
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
