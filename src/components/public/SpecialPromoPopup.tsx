"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PublicShowtimeDto } from "@/server/dto/showtime.dto";

function formatCOP(amount: number): string {
  return amount.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

/**
 * Ventana emergente de promoción: aparece al abrir la página de reservas
 * cuando hay una función especial próxima con cupos. Se muestra una sola vez
 * por visita (sesión del navegador) para no molestar si el cliente vuelve al inicio.
 */
export function SpecialPromoPopup({ showtime }: { showtime: PublicShowtimeDto }) {
  const storageKey = `cine-respiro-promo-${showtime.id}`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alreadySeen = false;
    try {
      alreadySeen = sessionStorage.getItem(storageKey) === "1";
    } catch {
      // Sin acceso a sessionStorage (modo privado, etc.): se muestra igual.
    }
    if (alreadySeen) return;
    const timer = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(timer);
  }, [storageKey]);

  function close() {
    setOpen(false);
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      // ignorar
    }
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Función especial: ${showtime.movie.title}`}
      onClick={close}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-gold/40 bg-ink-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-ink/80 text-cream hover:text-gold"
        >
          ✕
        </button>

        {showtime.specialAdImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={showtime.specialAdImageUrl} alt={`Anuncio: ${showtime.movie.title}`} className="w-full object-cover" />
        )}

        <div className="flex flex-col gap-3 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold">★ Función especial</p>
          <h3 className="font-display text-2xl text-cream">{showtime.movie.title}</h3>
          <p className="text-sm text-gold">
            {showtime.dateLabel} · {showtime.timeLabel}
            {showtime.roomName ? ` · ${showtime.roomName}` : ""}
          </p>
          {showtime.specialDescription && <p className="text-sm text-cream-dim">{showtime.specialDescription}</p>}
          <p className="text-sm font-semibold text-cream">
            Menú especial: {formatCOP(showtime.specialMenuPrice ?? 0)} por persona
          </p>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={close}
              className="flex-1 rounded-full border border-line px-4 py-2.5 text-sm text-cream-dim hover:border-gold hover:text-gold"
            >
              Ahora no
            </button>
            <Link
              href={`/reservar?showtimeId=${showtime.id}`}
              className="flex-1 rounded-full bg-gold px-4 py-2.5 text-center text-sm font-semibold text-ink transition-colors hover:bg-gold-soft"
            >
              Continuar →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
