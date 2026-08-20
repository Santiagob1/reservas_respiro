"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api-client";
import { formatCOP } from "@/components/public/wizard/types";

interface TodayShowtime {
  id: string;
  movieTitle: string;
  dateLabel: string;
  timeLabel: string;
  status: string;
  capacity: number;
  confirmed: number;
  pending: number;
  available: number;
  occupancyPct: number;
  reservationsCount: number;
  pendingPaymentsCount: number;
  revenue: number;
}

interface DashboardSummary {
  today: TodayShowtime[];
  totals: { totalMovies: number; totalUpcomingShowtimes: number; totalPendingPayments: number };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    apiGet<DashboardSummary>("/api/admin/dashboard").then(setData).catch(() => {});
  }, []);

  if (!data) return <p className="text-muted">Cargando...</p>;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl text-cream">Hoy</h1>
        <p className="text-sm text-cream-dim">Resumen de la operación del día.</p>
      </div>

      {data.today.length === 0 && (
        <p className="rounded-2xl border border-line bg-ink-card p-8 text-center text-muted">
          No hay función programada para hoy.
        </p>
      )}

      {data.today.map((s) => (
        <div key={s.id} className="rounded-2xl border border-line bg-ink-card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl text-cream">{s.movieTitle}</h2>
            <span className="text-sm text-gold">{s.timeLabel}</span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Capacidad" value={String(s.capacity)} />
            <Stat label="Confirmadas" value={String(s.confirmed)} />
            <Stat label="Pendientes" value={String(s.pending)} />
            <Stat label="Disponibles" value={String(s.available)} />
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-ink">
            <div className="h-full bg-gold" style={{ width: `${s.occupancyPct}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">{s.occupancyPct}% de ocupación</p>

          <div className="mt-5 flex flex-wrap gap-6 text-sm text-cream-dim">
            <span>{s.reservationsCount} reservas</span>
            <span className="text-gold">{formatCOP(s.revenue)} vendidos</span>
            {s.pendingPaymentsCount > 0 && (
              <span className="text-warning">{s.pendingPaymentsCount} pago(s) pendiente(s)</span>
            )}
          </div>
        </div>
      ))}

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/admin/peliculas" className="rounded-2xl border border-line bg-ink-card p-5 hover:border-gold">
          <p className="text-sm text-cream-dim">Películas activas</p>
          <p className="font-display text-3xl text-cream">{data.totals.totalMovies}</p>
        </Link>
        <Link href="/admin/funciones" className="rounded-2xl border border-line bg-ink-card p-5 hover:border-gold">
          <p className="text-sm text-cream-dim">Funciones próximas</p>
          <p className="font-display text-3xl text-cream">{data.totals.totalUpcomingShowtimes}</p>
        </Link>
        <Link
          href="/admin/reservas?status=PENDING_PAYMENT"
          className="rounded-2xl border border-line bg-ink-card p-5 hover:border-gold"
        >
          <p className="text-sm text-cream-dim">Pagos pendientes</p>
          <p className="font-display text-3xl text-warning">{data.totals.totalPendingPayments}</p>
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="font-display text-2xl text-cream">{value}</p>
    </div>
  );
}
