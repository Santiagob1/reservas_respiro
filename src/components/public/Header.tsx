"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/ui/Logo";

export function Header({
  instagramUrl,
  tiktokUrl,
  locationUrl,
  menuUrl,
  whatsapp,
}: {
  instagramUrl?: string;
  tiktokUrl?: string;
  locationUrl?: string;
  menuUrl?: string;
  whatsapp?: string;
}) {
  const [open, setOpen] = useState(false);
  const whatsappUrl = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, "")}` : undefined;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-6 sm:flex">
          {menuUrl && (
            <Link
              href={menuUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-cream-dim hover:text-gold transition-colors"
            >
              Carta
            </Link>
          )}
          <Link href="/nosotros" className="text-sm text-cream-dim hover:text-gold transition-colors">
            Nosotros
          </Link>
          <Link href="/mi-reserva" className="text-sm text-cream-dim hover:text-gold transition-colors">
            Mi reserva
          </Link>
          <SocialIcons
            instagramUrl={instagramUrl}
            tiktokUrl={tiktokUrl}
            locationUrl={locationUrl}
            whatsappUrl={whatsappUrl}
          />
          <Link
            href="/#agenda"
            className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-gold-soft"
          >
            Reservar
          </Link>
        </nav>

        <button
          type="button"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          className="flex flex-col gap-1.5 p-2 sm:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`h-0.5 w-6 bg-cream transition-transform ${open ? "translate-y-2 rotate-45" : ""}`} />
          <span className={`h-0.5 w-6 bg-cream transition-opacity ${open ? "opacity-0" : ""}`} />
          <span className={`h-0.5 w-6 bg-cream transition-transform ${open ? "-translate-y-2 -rotate-45" : ""}`} />
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-line px-4 py-3 sm:hidden">
          {menuUrl && (
            <Link
              href={menuUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-3 py-3 text-cream-dim hover:bg-ink-soft"
              onClick={() => setOpen(false)}
            >
              Carta
            </Link>
          )}
          <Link href="/nosotros" className="rounded-lg px-3 py-3 text-cream-dim hover:bg-ink-soft" onClick={() => setOpen(false)}>
            Nosotros
          </Link>
          <Link
            href="/mi-reserva"
            className="rounded-lg px-3 py-3 text-cream-dim hover:bg-ink-soft"
            onClick={() => setOpen(false)}
          >
            Mi reserva
          </Link>
          <div className="flex items-center gap-4 px-3 py-2">
            <SocialIcons
              instagramUrl={instagramUrl}
              tiktokUrl={tiktokUrl}
              locationUrl={locationUrl}
              whatsappUrl={whatsappUrl}
            />
          </div>
          <Link
            href="/#agenda"
            className="mt-1 rounded-lg bg-gold px-3 py-3 text-center font-semibold text-ink"
            onClick={() => setOpen(false)}
          >
            Reservar
          </Link>
        </nav>
      )}
    </header>
  );
}

function SocialIcons({
  instagramUrl,
  tiktokUrl,
  locationUrl,
  whatsappUrl,
}: {
  instagramUrl?: string;
  tiktokUrl?: string;
  locationUrl?: string;
  whatsappUrl?: string;
}) {
  if (!instagramUrl && !tiktokUrl && !locationUrl && !whatsappUrl) return null;
  return (
    <div className="flex items-center gap-3">
      {locationUrl && (
        <a
          href={locationUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ubicación"
          className="text-cream-dim hover:text-gold transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 21.5s7-6.4 7-12A7 7 0 0 0 5 9.5c0 5.6 7 12 7 12Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="9.5" r="2.4" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </a>
      )}
      {instagramUrl && (
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          className="text-cream-dim hover:text-gold transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="2.5" y="2.5" width="19" height="19" rx="5" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" />
          </svg>
        </a>
      )}
      {tiktokUrl && (
        <a
          href={tiktokUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="TikTok"
          className="text-cream-dim hover:text-gold transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M16 3c.4 2.2 1.8 3.7 4 4v3c-1.5 0-2.8-.4-4-1.2v6.3a5.4 5.4 0 1 1-5.4-5.4c.3 0 .6 0 .9.1v3.1a2.4 2.4 0 1 0 1.7 2.3V3h2.8Z"
              fill="currentColor"
            />
          </svg>
        </a>
      )}
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp"
          className="text-cream-dim hover:text-gold transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2.5c5.25 0 9.5 4.25 9.5 9.5 0 4.75-3.5 8.68-8.06 9.39L4 22.5l1.2-4.6A9.46 9.46 0 0 1 2.5 12c0-5.25 4.25-9.5 9.5-9.5Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="M8.3 8.6c.2-.5.5-.5.8-.5h.5c.2 0 .4 0 .5.4.2.5.6 1.5.6 1.6.1.1.1.3 0 .4-.1.2-.2.3-.3.4-.1.1-.3.3-.4.4-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.2.1 1.5.7 1.8.8.3.1.5.2.5.3.1.4.1.8-.1 1.2-.2.4-1.1.9-1.6 1-.5.1-1 .1-3.2-.7-2.6-1-4.3-3.7-4.5-3.9-.1-.2-1.1-1.5-1.1-2.9 0-1.4.7-2 1-2.3Z"
              fill="currentColor"
            />
          </svg>
        </a>
      )}
    </div>
  );
}
