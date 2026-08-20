"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api-client";
import { formatCOP } from "@/components/public/wizard/types";

interface ReservationDto {
  code: string;
  status: string;
  expiresAt: string | null;
  cancelReason: string | null;
  customer: { fullName: string; whatsapp: string };
  showtime: { movieTitle: string; posterUrl: string | null; dateLabel: string; timeLabel: string; status: string };
  adults: number;
  children: number;
  items: { name: string; quantity: number; unitPrice: number; total: number }[];
  totalAmount: number;
  payments: { method: string; status: string; amount: number }[];
  hasQr: boolean;
  checkedIn: boolean;
  checkedInAt: string | null;
}

const STATUS_COPY: Record<string, { title: string; tone: string; description: string }> = {
  PENDING_PAYMENT: {
    title: "Pago pendiente",
    tone: "text-warning",
    description: "Tu pago todavía está siendo procesado.",
  },
  PAYMENT_APPROVED: {
    title: "Pago aprobado",
    tone: "text-success",
    description: "Estamos confirmando tu reserva.",
  },
  CONFIRMED: { title: "Reserva confirmada", tone: "text-success", description: "Ya está. Tienes tu entrada." },
  CHECKED_IN: { title: "Ingreso registrado", tone: "text-success", description: "Ya hiciste check-in en el cine." },
  CANCELLED: { title: "Reserva cancelada", tone: "text-danger", description: "Esta reserva fue cancelada." },
  EXPIRED: {
    title: "Reserva expirada",
    tone: "text-danger",
    description: "El tiempo para completar esta reserva terminó y los cupos fueron liberados.",
  },
  REFUNDED: { title: "Reserva reembolsada", tone: "text-muted", description: "El pago fue reembolsado." },
  NO_SHOW: { title: "No asistió", tone: "text-muted", description: "Esta reserva fue marcada como no-show." },
};

export function ReservationDetail({ code, contact }: { code: string; contact: string }) {
  const [reservation, setReservation] = useState<ReservationDto | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await apiGet<ReservationDto>(
          `/api/reservations/${code}?contact=${encodeURIComponent(contact)}`
        );
        if (cancelled) return;
        setReservation(data);
        if (data.hasQr) {
          const qr = await apiGet<{ dataUrl: string }>(
            `/api/reservations/${code}/qr?contact=${encodeURIComponent(contact)}`
          );
          if (!cancelled) setQrDataUrl(qr.dataUrl);
        }
      } catch {
        if (!cancelled) setError("No encontramos una reserva con esos datos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [code, contact]);

  if (loading) return <p className="p-10 text-center text-muted">Buscando tu reserva...</p>;
  if (error || !reservation) {
    return (
      <div className="p-10 text-center">
        <p className="text-danger">{error}</p>
        <Link href="/mi-reserva" className="mt-4 inline-block text-gold hover:underline">
          Intentar de nuevo
        </Link>
      </div>
    );
  }

  const copy = STATUS_COPY[reservation.status] ?? STATUS_COPY.PENDING_PAYMENT;
  const people = reservation.adults + reservation.children;

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="text-center">
        <p className={`font-display text-3xl ${copy.tone}`}>{copy.title}</p>
        <p className="mt-2 text-cream-dim">{copy.description}</p>
        {reservation.cancelReason && (
          <p className="mt-1 text-sm text-muted">Motivo: {reservation.cancelReason}</p>
        )}
      </div>

      {qrDataUrl && (
        <div className="mt-8 flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Código QR de tu reserva" className="h-56 w-56 rounded-2xl bg-cream p-3" />
          <p className="text-xs text-muted">Presenta este código QR al llegar al cine</p>
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-line bg-ink-card p-5">
        <p className="text-xs uppercase tracking-widest text-gold">Código {reservation.code}</p>
        <p className="mt-1 font-display text-2xl text-cream">{reservation.showtime.movieTitle}</p>
        <p className="text-sm text-cream-dim">
          {reservation.showtime.dateLabel} · {reservation.showtime.timeLabel}
        </p>
        <p className="mt-2 text-sm text-cream-dim">
          {people} persona{people === 1 ? "" : "s"} · {reservation.customer.fullName}
        </p>

        <ul className="mt-4 flex flex-col gap-1 text-sm text-cream-dim">
          {reservation.items.map((item, i) => (
            <li key={i} className="flex justify-between">
              <span>
                {item.quantity} × {item.name}
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

      <Link href="/" className="mt-6 block text-center text-sm text-gold hover:underline">
        Volver al inicio
      </Link>
    </div>
  );
}
