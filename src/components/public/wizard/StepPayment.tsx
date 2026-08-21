"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { apiPost, ApiError } from "@/lib/api-client";
import { calculateTotal, formatCOP, totalPeople, type TicketTypeDto, type WizardState } from "./types";
import type { PublicPaymentSettings } from "./ReservationWizard";

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
  paymentSettings,
  onBack,
}: {
  state: WizardState;
  ticketTypes: TicketTypeDto[];
  paymentSettings: PublicPaymentSettings;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateReservationResponse | null>(null);
  const [copied, setCopied] = useState(false);

  if (!state.showtime) return null;
  const total = calculateTotal(state, ticketTypes);

  async function createReservation(paymentMethod: "ONLINE" | "BANK_TRANSFER") {
    if (!state.showtime) return null;
    return apiPost<CreateReservationResponse>("/api/reservations", {
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
      paymentMethod,
    });
  }

  async function handleTransferConfirm() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const reservation = await createReservation("BANK_TRANSFER");
      setCreated(reservation);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ocurrió un problema inesperado. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOnlinePay() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const reservation = await createReservation("ONLINE");
      if (!reservation) return;
      const payment = await apiPost<InitiatePaymentResponse>(`/api/reservations/${reservation.id}/payment`);
      if (payment.checkoutUrl) {
        window.location.href = payment.checkoutUrl;
      } else {
        setError("No pudimos iniciar el pago. Intenta nuevamente en unos minutos.");
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ocurrió un problema inesperado. Intenta nuevamente.");
      setLoading(false);
    }
  }

  function copyKey() {
    navigator.clipboard?.writeText(paymentSettings.paymentTransferKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // --- Reserva ya creada, en modo transferencia: mostrar instrucciones + WhatsApp ---
  if (created) {
    const whatsappText = `Hola Cine Respiro, les envío el comprobante de pago de mi reserva ${created.code} (${state.showtime.movie.title}, ${state.showtime.dateLabel} ${state.showtime.timeLabel}, ${formatCOP(created.totalAmount)}).`;
    const whatsappUrl = `https://wa.me/${paymentSettings.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(whatsappText)}`;

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="font-display text-2xl text-cream">Reserva registrada</h2>
          <p className="text-sm text-cream-dim">
            Tu código es <span className="font-semibold text-gold">{created.code}</span>. Se confirma en
            cuanto recibamos tu comprobante de pago.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-ink-card p-5">
          {paymentSettings.paymentQrUrl && (
            <div className="mb-4 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={paymentSettings.paymentQrUrl}
                alt="Código QR para transferir"
                className="h-56 w-56 rounded-xl bg-cream object-contain p-2"
              />
            </div>
          )}
          <p className="text-xs uppercase tracking-widest text-gold">Transfiere a</p>
          <div className="mt-1 flex items-center gap-3">
            <p className="font-display text-2xl text-cream">{paymentSettings.paymentTransferKey}</p>
            <button
              type="button"
              onClick={copyKey}
              className="rounded-full border border-line px-3 py-1 text-xs text-cream-dim hover:border-gold hover:text-gold"
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="mt-3 text-sm text-cream-dim">{paymentSettings.paymentTransferInstructions}</p>
          <div className="mt-4 flex justify-between border-t border-line pt-3">
            <span className="font-semibold text-cream">Total a transferir</span>
            <span className="font-display text-xl text-gold">{formatCOP(created.totalAmount)}</span>
          </div>
        </div>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-gold-soft"
        >
          Enviar comprobante por WhatsApp
        </a>

        <p className="text-xs text-muted">
          Tu reserva queda pendiente hasta que confirmemos el pago. Si no llega el comprobante a
          tiempo, los cupos se liberan automáticamente.
        </p>

        <Link
          href={`/reserva/${created.code}?contact=${encodeURIComponent(state.whatsapp)}`}
          className="text-center text-sm text-gold hover:underline"
        >
          Ver el estado de mi reserva
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl text-cream">Confirma tu reserva</h2>

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
          <span className="font-semibold text-cream">Total</span>
          <span className="font-display text-2xl text-gold">{formatCOP(total)}</span>
        </div>
      </div>

      {paymentSettings.paymentMode === "transfer" ? (
        <p className="text-xs text-muted">
          Al confirmar verás los datos para transferir y un botón para enviarnos el comprobante
          por WhatsApp. Tu reserva se confirma cuando verifiquemos el pago.
        </p>
      ) : (
        <p className="text-xs text-muted">
          Serás redirigido a nuestra pasarela de pago segura. Tu reserva quedará confirmada solo
          cuando el pago sea aprobado.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onBack} disabled={loading}>
          Atrás
        </Button>
        {paymentSettings.paymentMode === "transfer" ? (
          <Button type="button" onClick={handleTransferConfirm} disabled={loading}>
            {loading ? "Guardando..." : "Confirmar reserva"}
          </Button>
        ) : (
          <Button type="button" onClick={handleOnlinePay} disabled={loading}>
            {loading ? "Procesando..." : `Pagar ${formatCOP(total)}`}
          </Button>
        )}
      </div>
    </div>
  );
}
