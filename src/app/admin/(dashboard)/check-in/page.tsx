"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { formatCOP } from "@/components/public/wizard/types";

interface ReservationPreview {
  code: string;
  status: string;
  customer: { fullName: string; whatsapp: string };
  showtime: { movieTitle: string; dateLabel: string; timeLabel: string };
  adults: number;
  children: number;
  totalAmount: number;
  checkedIn: boolean;
  checkedInAt: string | null;
}

export default function CheckInPage() {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [preview, setPreview] = useState<ReservationPreview | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!scannerActive || !scannerRef.current) return;
    let scanner: import("html5-qrcode").Html5QrcodeScanner | null = null;
    let cancelled = false;

    import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
      if (cancelled || !scannerRef.current) return;
      scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: 250 },
        false
      );
      scanner.render(
        (decodedText) => {
          lookup({ token: decodedText });
        },
        () => {}
      );
    });

    return () => {
      cancelled = true;
      scanner?.clear().catch(() => {});
    };
  }, [scannerActive]);

  async function lookup(params: { token?: string; code?: string }) {
    setError(null);
    setSuccess(null);
    try {
      const qs = new URLSearchParams(params as Record<string, string>);
      const data = await apiGet<ReservationPreview>(`/api/admin/checkin/lookup?${qs}`);
      setPreview(data);
      setToken(params.token ?? null);
      if (!params.token) setManualCode("");
    } catch (err) {
      setPreview(null);
      setError(err instanceof ApiError ? err.message : "No pudimos validar este código.");
    }
  }

  async function confirm(force = false) {
    if (busy || !preview) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost("/api/admin/checkin", {
        token: token ?? undefined,
        code: token ? undefined : preview.code,
        force,
      });
      setSuccess(`Ingreso registrado para ${preview.code}.`);
      setPreview(null);
      setToken(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos registrar el ingreso.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-cream">Control de ingreso</h1>
        <p className="text-sm text-cream-dim">Escanea el QR del cliente o busca por código.</p>
      </div>

      {!scannerActive ? (
        <Button onClick={() => setScannerActive(true)}>Activar cámara</Button>
      ) : (
        <div id="qr-reader" ref={scannerRef} className="overflow-hidden rounded-2xl" />
      )}

      <form
        className="flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (manualCode.trim()) lookup({ code: manualCode.trim().toUpperCase() });
        }}
      >
        <input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="Código de reserva CIN-XXXXX"
          className="flex-1 rounded-xl border border-line bg-ink px-4 py-3 text-cream outline-none focus:border-gold"
        />
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      {error && <p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {success && (
        <p className="rounded-xl border border-success/40 bg-success/10 p-3 text-sm text-success">{success}</p>
      )}

      {preview && (
        <div className="rounded-2xl border border-line bg-ink-card p-5">
          {preview.checkedIn ? (
            <>
              <p className="font-display text-xl text-danger">Reserva ya utilizada</p>
              <p className="mt-1 text-sm text-cream-dim">
                Esta reserva registró ingreso el{" "}
                {preview.checkedInAt ? new Date(preview.checkedInAt).toLocaleString("es-CO") : ""}.
              </p>
            </>
          ) : (
            <p className="font-display text-xl text-success">Reserva válida</p>
          )}

          <p className="mt-3 text-cream">{preview.showtime.movieTitle}</p>
          <p className="text-sm text-cream-dim">
            {preview.showtime.dateLabel} · {preview.showtime.timeLabel}
          </p>
          <p className="text-sm text-cream-dim">
            {preview.adults + preview.children} personas · {formatCOP(preview.totalAmount)}
          </p>
          <p className="text-sm text-cream-dim">{preview.customer.fullName}</p>

          <div className="mt-4 flex gap-3">
            {!preview.checkedIn && (
              <Button disabled={busy} onClick={() => confirm(false)}>
                Registrar ingreso
              </Button>
            )}
            {preview.checkedIn && (
              <Button variant="secondary" disabled={busy} onClick={() => confirm(true)}>
                Autorizar re-ingreso
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
