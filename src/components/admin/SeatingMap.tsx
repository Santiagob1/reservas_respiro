"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";

interface ModuleDetail {
  id: string;
  label: string;
  type: "COUPLE" | "TRIO";
  baseCapacity: number;
  occupied: boolean;
  seatsOccupied: number | null;
  usesAuxiliary: boolean;
  reservation: { code: string; customerName: string; status: string } | null;
}

interface SeatingDetail {
  modules: ModuleDetail[];
  remainingAux: number;
  auxCount: number;
}

export function SeatingMap({ showtimeId }: { showtimeId: string }) {
  const [detail, setDetail] = useState<SeatingDetail | null>(null);

  useEffect(() => {
    apiGet<SeatingDetail>(`/api/admin/showtimes/${showtimeId}/seating`).then(setDetail);
  }, [showtimeId]);

  if (!detail) return <p className="text-xs text-muted">Cargando distribución...</p>;

  return (
    <div className="rounded-xl border border-line bg-ink p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {detail.modules.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg border p-3 text-xs ${
              m.occupied ? "border-gold/50 bg-ink-soft" : "border-line/60 text-muted"
            }`}
          >
            <p className="font-semibold text-cream">{m.label}</p>
            <p className="text-[11px] text-muted">
              {m.type === "COUPLE" ? "Pareja" : "Trío"} · base {m.baseCapacity}
              {m.usesAuxiliary ? " + auxiliar" : ""}
            </p>
            {m.occupied && m.reservation ? (
              <p className="mt-1 text-gold">
                {m.seatsOccupied} pers. · {m.reservation.customerName} ({m.reservation.code})
              </p>
            ) : (
              <p className="mt-1 text-muted">Libre</p>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Auxiliares en uso: {detail.auxCount - detail.remainingAux} de {detail.auxCount}
      </p>
    </div>
  );
}
