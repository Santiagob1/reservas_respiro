import Link from "next/link";
import { listPublicShowtimes } from "@/server/services/public-showtime.service";
import { getSettings } from "@/server/services/settings.service";
import { getCinemaTodayKey } from "@/lib/timezone";
import { AgendaPicker } from "@/components/public/AgendaPicker";

export default async function HomePage() {
  const [showtimes, settings] = await Promise.all([listPublicShowtimes(), getSettings()]);
  const nextShowtime = showtimes[0];
  const todayKey = getCinemaTodayKey();

  return (
    <>
      <section className="relative overflow-hidden border-b border-line px-4 py-16 sm:px-6 sm:py-20">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            background:
              "radial-gradient(circle at 20% 20%, var(--color-gold) 0%, transparent 45%), radial-gradient(circle at 80% 60%, var(--color-gold) 0%, transparent 40%)",
          }}
        />
        <div className="relative mx-auto flex max-w-3xl flex-col items-start gap-4">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">{settings.cinema_tagline}</p>
          <h1 className="font-display text-4xl leading-tight text-cream sm:text-5xl">
            {settings.cinema_hero_message}
          </h1>
          <Link
            href={nextShowtime ? `/reservar?showtimeId=${nextShowtime.id}` : "#agenda"}
            className="rounded-full bg-gold px-8 py-3 font-semibold text-ink transition-colors hover:bg-gold-soft"
          >
            Reservar
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h2 className="font-display text-2xl text-cream">Elige tu función</h2>
        <div className="mt-6">
          <AgendaPicker showtimes={showtimes} todayKey={todayKey} />
        </div>
      </section>
    </>
  );
}
