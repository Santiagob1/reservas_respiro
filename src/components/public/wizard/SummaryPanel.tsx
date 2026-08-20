import type { TicketTypeDto, WizardState } from "./types";
import { calculateTotal, formatCOP, totalPeople } from "./types";

export function SummaryPanel({
  state,
  ticketTypes,
}: {
  state: WizardState;
  ticketTypes: TicketTypeDto[];
}) {
  const total = calculateTotal(state, ticketTypes);
  const people = totalPeople(state);

  if (!state.showtime) return null;

  return (
    <aside className="rounded-2xl border border-line bg-ink-card p-5">
      <p className="text-xs uppercase tracking-widest text-gold">Resumen</p>
      <h3 className="mt-1 font-display text-xl text-cream">{state.showtime.movie.title}</h3>
      <p className="text-sm text-cream-dim">
        {state.showtime.dateLabel} · {state.showtime.timeLabel}
      </p>

      {people > 0 && <p className="mt-3 text-sm text-cream-dim">{people} persona{people === 1 ? "" : "s"}</p>}

      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {ticketTypes
          .filter((t) => (state.itemQuantities[t.id] ?? 0) > 0)
          .map((t) => (
            <li key={t.id} className="flex justify-between text-cream-dim">
              <span>
                {state.itemQuantities[t.id]} {t.name}
              </span>
              <span>{formatCOP(t.price * (state.itemQuantities[t.id] ?? 0))}</span>
            </li>
          ))}
      </ul>

      <div className="mt-4 flex justify-between border-t border-line pt-3">
        <span className="font-semibold text-cream">Total</span>
        <span className="font-display text-xl text-gold">{formatCOP(total)}</span>
      </div>
    </aside>
  );
}
