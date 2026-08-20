"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { apiGet, apiPost } from "@/lib/api-client";

interface MockPaymentInfo {
  code: string;
  movieTitle: string;
  dateLabel: string;
  timeLabel: string;
  totalAmount: number;
  contact: string;
}

export default function MockPaymentPage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const { reservationId } = use(params);
  const searchParams = useSearchParams();
  const txId = searchParams.get("txId") ?? "";
  const router = useRouter();

  const [info, setInfo] = useState<MockPaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<MockPaymentInfo>(`/api/mock-payment/${reservationId}`)
      .then(setInfo)
      .catch(() => setError("No pudimos cargar la información de esta reserva."))
      .finally(() => setLoading(false));
  }, [reservationId]);

  async function resolve(approve: boolean) {
    if (processing) return;
    setProcessing(true);
    try {
      const result = await apiPost<{ code: string }>("/api/mock-payment/resolve", {
        reservationId,
        txId,
        approve,
      });
      const contact = info?.contact ?? "";
      router.push(`/reserva/${result.code}/estado?contact=${encodeURIComponent(contact)}`);
    } catch {
      setError("No pudimos procesar el pago simulado.");
      setProcessing(false);
    }
  }

  if (loading) return <p className="p-10 text-center text-muted">Cargando...</p>;
  if (error || !info) return <p className="p-10 text-center text-danger">{error}</p>;

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
      <p className="text-xs uppercase tracking-widest text-gold">Pasarela simulada (modo desarrollo)</p>
      <h1 className="mt-2 font-display text-3xl text-cream">Confirmar pago</h1>
      <p className="mt-4 text-cream-dim">
        {info.movieTitle} · {info.dateLabel} · {info.timeLabel}
      </p>
      <p className="mt-6 font-display text-4xl text-gold">
        {info.totalAmount.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}
      </p>
      <p className="mt-2 text-xs text-muted">Reserva {info.code}</p>

      <div className="mt-10 flex flex-col gap-3">
        <Button onClick={() => resolve(true)} disabled={processing}>
          {processing ? "Procesando..." : "Aprobar pago"}
        </Button>
        <Button variant="secondary" onClick={() => resolve(false)} disabled={processing}>
          Rechazar pago
        </Button>
      </div>
    </div>
  );
}
