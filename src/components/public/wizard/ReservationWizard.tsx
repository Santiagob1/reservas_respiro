"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api-client";
import { StepIndicator } from "./StepIndicator";
import { SummaryPanel } from "./SummaryPanel";
import { WizardHeader } from "./WizardHeader";
import { StepTickets } from "./StepTickets";
import { StepDetails } from "./StepDetails";
import { StepPayment } from "./StepPayment";
import type { TicketTypeDto, WizardState } from "./types";
import type { PublicShowtimeDto } from "@/server/dto/showtime.dto";

const INITIAL_STATE: WizardState = {
  step: 1,
  showtime: null,
  itemQuantities: {},
  fullName: "",
  whatsapp: "",
  email: "",
  acceptedTerms: false,
};

export function ReservationWizard({ initialShowtimeId }: { initialShowtimeId?: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketTypeDto[]>([]);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [allShowtimes, allTicketTypes] = await Promise.all([
          apiGet<PublicShowtimeDto[]>("/api/showtimes"),
          apiGet<TicketTypeDto[]>("/api/ticket-types"),
        ]);
        if (cancelled) return;

        setTicketTypes(allTicketTypes);

        const initial = allShowtimes.find((s) => s.id === initialShowtimeId) ?? null;

        if (!initial) {
          setError("No encontramos esa función. Vuelve al inicio y elige una fecha.");
        } else {
          setState((prev) => ({ ...prev, showtime: initial }));
        }
      } catch {
        setError("No pudimos cargar la información de reservas. Intenta nuevamente.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [initialShowtimeId]);

  function patch(p: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...p }));
  }
  function goTo(step: number) {
    setState((prev) => ({ ...prev, step }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading) {
    return <p className="p-8 text-center text-muted">Cargando...</p>;
  }

  if (error || !state.showtime) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <p className="text-cream-dim">{error ?? "No hay funciones disponibles."}</p>
        <Link href="/" className="mt-4 inline-block text-gold hover:underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  const maxAvailable = state.showtime.available;

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        <WizardHeader showtime={state.showtime} />
        <StepIndicator step={state.step} />

        {state.step === 1 && (
          <StepTickets
            state={state}
            ticketTypes={ticketTypes}
            maxAvailable={maxAvailable}
            onChangeItem={(id, v) => patch({ itemQuantities: { ...state.itemQuantities, [id]: v } })}
            onContinue={() => goTo(2)}
          />
        )}

        {state.step === 2 && (
          <StepDetails state={state} onChange={patch} onBack={() => goTo(1)} onContinue={() => goTo(3)} />
        )}

        {state.step === 3 && (
          <StepPayment state={state} ticketTypes={ticketTypes} onBack={() => goTo(2)} />
        )}
      </div>

      <div className="hidden lg:block">
        <div className="sticky top-24">
          <SummaryPanel state={state} ticketTypes={ticketTypes} />
        </div>
      </div>

      <div className="lg:hidden">
        <SummaryPanel state={state} ticketTypes={ticketTypes} />
      </div>
    </div>
  );
}
