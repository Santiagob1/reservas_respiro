"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { ReservationDetail } from "@/components/public/ReservationDetail";

const MAX_POLLS = 8;
const POLL_INTERVAL_MS = 2000;

export function PaymentStatus({ code, contact }: { code: string; contact: string }) {
  const [ready, setReady] = useState(false);
  const attempts = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const data = await apiGet<{ status: string }>(
          `/api/reservations/${code}?contact=${encodeURIComponent(contact)}`
        );
        attempts.current += 1;
        const stillPending = data.status === "PENDING_PAYMENT";
        if (cancelled) return;
        if (!stillPending || attempts.current >= MAX_POLLS) {
          setReady(true);
        } else {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch {
        if (!cancelled) setReady(true);
      }
    }
    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, contact]);

  if (!ready) {
    return (
      <div className="p-16 text-center">
        <p className="font-display text-2xl text-cream">Verificando tu pago...</p>
        <p className="mt-2 text-cream-dim">Esto solo toma unos segundos.</p>
      </div>
    );
  }

  return <ReservationDetail code={code} contact={contact} />;
}
