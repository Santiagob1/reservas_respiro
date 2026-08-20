import { Button } from "@/components/ui/Button";
import { Counter } from "./Counter";
import { formatCOP, totalPeople, type TicketTypeDto, type WizardState } from "./types";

export function StepTickets({
  state,
  ticketTypes,
  maxAvailable,
  onChangeItem,
  onContinue,
}: {
  state: WizardState;
  ticketTypes: TicketTypeDto[];
  maxAvailable: number;
  onChangeItem: (ticketTypeId: string, v: number) => void;
  onContinue: () => void;
}) {
  const people = totalPeople(state);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl text-cream">Elige tus entradas</h2>
        <p className="text-sm text-cream-dim">Cada entrada corresponde a una persona.</p>

        <div className="mt-4 flex flex-col gap-3">
          {ticketTypes.map((t) => (
            <div key={t.id} className="rounded-xl border border-line p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-cream">{t.name}</p>
                  <p className="text-sm text-gold">{formatCOP(t.price)}</p>
                  {t.includes.length > 0 && (
                    <p className="mt-1 text-xs text-muted">{t.includes.join(" · ")}</p>
                  )}
                </div>
                <Counter
                  label=""
                  value={state.itemQuantities[t.id] ?? 0}
                  max={maxAvailable}
                  onChange={(v) => onChangeItem(t.id, v)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Button onClick={onContinue} disabled={people === 0}>
        Continuar
      </Button>
    </div>
  );
}
