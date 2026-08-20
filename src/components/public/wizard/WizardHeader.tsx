import Link from "next/link";
import type { PublicShowtimeDto } from "@/server/dto/showtime.dto";

export function WizardHeader({ showtime }: { showtime: PublicShowtimeDto }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-ink-card px-4 py-3">
      <div>
        <p className="font-display text-lg text-cream">{showtime.movie.title}</p>
        <p className="text-xs text-gold">
          {showtime.dateLabel} · {showtime.timeLabel}
        </p>
      </div>
      <Link href="/#agenda" className="shrink-0 text-xs text-cream-dim hover:text-gold">
        Cambiar función
      </Link>
    </div>
  );
}
