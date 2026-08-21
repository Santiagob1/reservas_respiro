"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/api-client";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import { formatCOP } from "@/components/public/wizard/types";
import { inputClass } from "@/components/admin/formStyles";

interface ReservationListItem {
  id: string;
  code: string;
  status: string;
  totalAmount: number;
  adults: number;
  children: number;
  createdAt: string;
  customer: { fullName: string; whatsapp: string };
  showtime: { id: string; startsAt: string; movie: { title: string } };
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ReservationsList() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<ReservationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    if (status) qs.set("status", status);
    if (dateFrom) qs.set("from", `${dateFrom}T00:00:00`);
    if (dateTo) qs.set("to", `${dateTo}T23:59:59`);
    apiGet<{ items: ReservationListItem[]; total: number }>(`/api/admin/reservations?${qs}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [search, status, dateFrom, dateTo]);

  function filterToday() {
    const t = todayKey();
    setDateFrom(t);
    setDateTo(t);
  }

  function clearDateFilter() {
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-cream">Reservas</h1>
          <p className="text-sm text-cream-dim">{total} reserva(s)</p>
        </div>
        <Link href="/admin/reservas/nueva">
          <Button>+ Reserva manual</Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <input
          placeholder="Buscar por código, nombre o WhatsApp"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[240px] flex-1 rounded-xl border border-line bg-ink px-4 py-2.5 text-cream outline-none focus:border-gold"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-line bg-ink px-4 py-2.5 text-cream outline-none focus:border-gold"
        >
          <option value="">Todos los estados</option>
          <option value="PENDING_PAYMENT">Pago pendiente</option>
          <option value="CONFIRMED">Confirmada</option>
          <option value="CHECKED_IN">Ingreso registrado</option>
          <option value="CANCELLED">Cancelada</option>
          <option value="EXPIRED">Expirada</option>
          <option value="REFUNDED">Reembolsada</option>
        </select>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Función desde
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          hasta
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
        </label>
        <Button variant="secondary" onClick={filterToday}>
          Hoy
        </Button>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" onClick={clearDateFilter}>
            Quitar filtro de fecha
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[780px] text-sm">
          <thead className="bg-ink-soft text-left text-muted">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Función</th>
              <th className="px-4 py-3">Personas</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Aún no hay reservas.
                </td>
              </tr>
            )}
            {items.map((r) => (
              <tr key={r.id} className="border-t border-line hover:bg-ink-soft">
                <td className="px-4 py-3">
                  <Link href={`/admin/reservas/${r.id}`} className="font-medium text-gold hover:underline">
                    {r.code}
                  </Link>
                </td>
                <td className="px-4 py-3 text-cream-dim">
                  {r.customer.fullName}
                  <br />
                  <span className="text-xs text-muted">{r.customer.whatsapp}</span>
                </td>
                <td className="px-4 py-3 text-cream-dim">
                  {r.showtime.movie.title}
                  <br />
                  <span className="text-xs text-gold">
                    {new Date(r.showtime.startsAt).toLocaleString("es-CO", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </td>
                <td className="px-4 py-3 text-cream-dim">{r.adults + r.children}</td>
                <td className="px-4 py-3 text-cream-dim">{formatCOP(r.totalAmount)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ReservationsPage() {
  return (
    <Suspense>
      <ReservationsList />
    </Suspense>
  );
}
