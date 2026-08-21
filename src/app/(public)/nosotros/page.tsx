import Link from "next/link";
import { getSettings } from "@/server/services/settings.service";

export default async function NosotrosPage() {
  const settings = await getSettings();
  const whatsappUrl = `https://wa.me/${settings.cinema_whatsapp.replace(/\D/g, "")}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="text-xs uppercase tracking-[0.3em] text-gold">Sobre nosotros</p>
      <h1 className="mt-2 font-display text-4xl text-cream">{settings.cinema_name}</h1>
      <p className="mt-6 whitespace-pre-line text-cream-dim leading-relaxed">{settings.about_us_text}</p>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-line px-5 py-2.5 text-sm text-cream hover:border-gold hover:text-gold"
        >
          Escríbenos por WhatsApp
        </Link>
        {settings.instagram_url && (
          <Link
            href={settings.instagram_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-line px-5 py-2.5 text-sm text-cream hover:border-gold hover:text-gold"
          >
            Síguenos en Instagram
          </Link>
        )}
        {settings.tiktok_url && (
          <Link
            href={settings.tiktok_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-line px-5 py-2.5 text-sm text-cream hover:border-gold hover:text-gold"
          >
            Síguenos en TikTok
          </Link>
        )}
        {settings.location_url && (
          <Link
            href={settings.location_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-line px-5 py-2.5 text-sm text-cream hover:border-gold hover:text-gold"
          >
            Cómo llegar
          </Link>
        )}
        {settings.menu_url && (
          <Link
            href={settings.menu_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-line px-5 py-2.5 text-sm text-cream hover:border-gold hover:text-gold"
          >
            Ver la carta
          </Link>
        )}
        <Link
          href="/#agenda"
          className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink hover:bg-gold-soft"
        >
          Ver funciones
        </Link>
      </div>
    </div>
  );
}
