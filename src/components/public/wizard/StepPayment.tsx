"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { apiPost, ApiError } from "@/lib/api-client";
import { calculateTotal, formatCOP, totalPeople, type TicketTypeDto, type WizardState } from "./types";

interface CreateReservationResponse {
  id: string;
  code: string;
  status: string;
  totalAmount: number;
  expiresAt: string | null;
}

interface InitiatePaymentResponse {
  provider: string;
  checkoutUrl?: string;
}

export function StepPayment({
  state,
  ticketTypes,
  onBack,
}: {
  state: WizardState;
  ticketTypes: TicketTypeDto[];
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!state.showtime) return null;
  const total = calculateTotal(state, ticketTypes);

  async function handlePay() {
    if (loading || !state.showtime) return;
    setLoading(true);
    setError(null);
    try {
      const reservation = await apiPost<CreateReservationResponse>("/api/reservations", {
        showtimeId: state.showtime.id,
        adults: totalPeople(state),
        children: 0,
        items: Object.entries(state.itemQuantities)
          .filter(([, qty]) => qty > 0)
          .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity })),
        customer: {
          fullName: state.fullName,
          whatsapp: state.whatsapp,
          email: state.email || undefined,
        },
        acceptedTerms: state.acceptedTerms,
      });

      const payment = await apiPost<InitiatePaymentResponse>(
        `/api/reservations/${reservation.id}/payment`
      );

      if (payment.checkoutUrl) {
        window.location.href = payment.checkoutUrl;
      } else {
        setError("No pudimos iniciar el pago. Intenta nuevamente en unos minutos.");
        setLoading(false);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Ocurrió un problema inesperado. Intenta nuevamente.");
      }
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl text-cream">Confirma y paga</h2>

      <div className="rounded-2xl border border-line bg-ink-card p-5">
        <p className="font-display text-xl text-cream">{state.showtime.movie.title}</p>
        <p className="text-sm text-gold">
          {state.showtime.dateLabel} · {state.showtime.timeLabel}
        </p>
        <ul className="mt-4 flex flex-col gap-1 text-sm text-cream-dim">
          {ticketTypes
            .filter((t) => (state.itemQuantities[t.id] ?? 0) > 0)
            .map((t) => (
              <li key={t.id} className="flex justify-between">
                <span>
                  {state.itemQuantities[t.id]} × {t.name}
                </span>
                <span>{formatCOP(t.price * (state.itemQuantities[t.id] ?? 0))}</span>
              </li>
            ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-line pt-3">
          <span className="font-semibold text-cream">Total a pagar</span>
          <span className="font-display text-2xl text-gold">{formatCOP(total)}</span>
        </div>
      </div>

      <p className="text-xs text-muted">
        Serás redirigido a nuestra pasarela de pago segura. Tu reserva quedará confirmada solo
        cuando el pago sea aprobado.
      </p>

      {error && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onBack} disabled={loading}>
          Atrás
        </Button>
        <Button type="button" onClick={handlePay} disabled={loading}>
          {loading ? "Procesando..." : `Pagar ${formatCOP(total)}`}
        </Button>
      </div>
    </div>
  );
}
