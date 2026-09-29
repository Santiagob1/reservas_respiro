"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { formatCOP } from "@/components/public/wizard/types";
import { inputClass } from "@/components/admin/formStyles";
import { Button } from "@/components/ui/Button";
import { zonedDayRangeToUtc } from "@/lib/timezone";

interface Report {
  byDay: { date: string; reservations: number; revenue: number; ticketsSold: number }[];
  byPaymentMethod: Record<string, number>;
  totals: { reservations: number; revenue: number; ticketsSold: number; averageTicket: number };
  cancelled: { count: number; amount: number; ticketsLost: number };
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayKey(): string {
  return toDateKey(new Date());
}

function daysAgoKey(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toDateKey(d);
}

export default function ReportsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(daysAgoKey(30));
  const [dateTo, setDateTo] = useState(todayKey());

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (dateFrom) qs.set("from", zonedDayRangeToUtc(dateFrom).from.toISOString());
    if (dateTo) qs.set("to", zonedDayRangeToUtc(dateTo).to.toISOString());
    apiGet<Report>(`/api/admin/reports?${qs}`)
      .then(setReport)
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  function setPreset(days: number) {
    setDateFrom(daysAgoKey(days));
    setDateTo(todayKey());
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl text-cream">Reportes</h1>
        <p className="text-sm text-cream-dim">Ventas entre las fechas que elijas.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-ink-card p-4">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Desde
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Hasta
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
        </label>
        <Button variant="secondary" onClick={() => setPreset(7)}>
          Últimos 7 días
        </Button>
        <Button variant="secondary" onClick={() => setPreset(30)}>
          Últimos 30 días
        </Button>
        <Button variant="secondary" onClick={() => setPreset(365)}>
          Último año
        </Button>
      </div>

      {loading || !report ? (
        <p className="text-muted">Cargando...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Stat label="Reservas" value={String(report.totals.reservations)} />
            <Stat label="Ingresos" value={formatCOP(report.totals.revenue)} />
            <Stat label="Entradas vendidas" value={String(report.totals.ticketsSold)} />
            <Stat label="Ticket promedio" value={formatCOP(report.totals.averageTicket)} />
          </div>

          <div className="rounded-2xl border border-line bg-ink-card p-5">
            <h2 className="mb-3 font-display text-xl text-cream">Por método de pago</h2>
            {Object.entries(report.byPaymentMethod).length === 0 && (
              <p className="text-sm text-muted">Sin datos en este período.</p>
            )}
            <ul className="flex flex-col gap-1 text-sm text-cream-dim">
              {Object.entries(report.byPaymentMethod).map(([method, amount]) => (
                <li key={method} className="flex justify-between">
                  <span>{method}</span>
                  <span>{formatCOP(amount)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[500px] text-sm">
              <thead className="bg-ink-soft text-left text-muted">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Reservas</th>
                  <th className="px-4 py-3">Entradas</th>
                  <th className="px-4 py-3">Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {report.byDay.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted">
                      No hay ventas registradas en este período.
                    </td>
                  </tr>
                )}
                {report.byDay.map((d) => (
                  <tr key={d.date} className="border-t border-line">
                    <td className="px-4 py-3 text-cream-dim">{d.date}</td>
                    <td className="px-4 py-3 text-cream-dim">{d.reservations}</td>
                    <td className="px-4 py-3 text-cream-dim">{d.ticketsSold}</td>
                    <td className="px-4 py-3 text-cream-dim">{formatCOP(d.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-danger/30 bg-danger/5 p-5">
            <h2 className="mb-1 font-display text-xl text-cream">Reservas canceladas</h2>
            <p className="mb-3 text-xs text-muted">
              Aparte de las ventas de arriba — no está incluido en los ingresos ni en el total de reservas.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="Canceladas" value={String(report.cancelled.count)} tone="text-danger" />
              <Stat label="Valor cancelado" value={formatCOP(report.cancelled.amount)} tone="text-danger" />
              <Stat label="Entradas perdidas" value={String(report.cancelled.ticketsLost)} tone="text-danger" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-ink-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`font-display text-2xl ${tone ?? "text-cream"}`}>{value}</p>
    </div>
  );
}
