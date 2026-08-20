"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { formatCOP } from "@/components/public/wizard/types";

interface Report {
  byDay: { date: string; reservations: number; revenue: number; ticketsSold: number; capacity: number }[];
  byPaymentMethod: Record<string, number>;
  totals: { reservations: number; revenue: number; ticketsSold: number; averageTicket: number };
}

export default function ReportsPage() {
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    apiGet<Report>("/api/admin/reports").then(setReport);
  }, []);

  if (!report) return <p className="text-muted">Cargando...</p>;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-3xl text-cream">Reportes (últimos 30 días)</h1>

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
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-ink-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="font-display text-2xl text-cream">{value}</p>
    </div>
  );
}
