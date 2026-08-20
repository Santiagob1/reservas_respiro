import { Button } from "@/components/ui/Button";
import type { WizardState } from "./types";

export function StepDetails({
  state,
  onChange,
  onBack,
  onContinue,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const valid =
    state.fullName.trim().length >= 3 &&
    /^\+?\d{7,15}$/.test(state.whatsapp.replace(/\s/g, "")) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim()) &&
    state.acceptedTerms;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onContinue();
      }}
    >
      <h2 className="font-display text-2xl text-cream">Tus datos</h2>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="fullName" className="text-sm text-cream-dim">
          Nombre completo
        </label>
        <input
          id="fullName"
          value={state.fullName}
          onChange={(e) => onChange({ fullName: e.target.value })}
          className="rounded-xl border border-line bg-ink px-4 py-3 text-cream outline-none focus:border-gold"
          placeholder="Tu nombre y apellido"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="whatsapp" className="text-sm text-cream-dim">
          WhatsApp
        </label>
        <input
          id="whatsapp"
          value={state.whatsapp}
          onChange={(e) => onChange({ whatsapp: e.target.value })}
          className="rounded-xl border border-line bg-ink px-4 py-3 text-cream outline-none focus:border-gold"
          placeholder="Ej. 3001234567"
          inputMode="tel"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm text-cream-dim">
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          value={state.email}
          onChange={(e) => onChange({ email: e.target.value })}
          className="rounded-xl border border-line bg-ink px-4 py-3 text-cream outline-none focus:border-gold"
          placeholder="tucorreo@ejemplo.com"
          required
        />
        <p className="text-xs text-muted">Te enviaremos la confirmación de tu reserva a este correo.</p>
      </div>

      <label className="flex items-start gap-3 text-sm text-cream-dim">
        <input
          type="checkbox"
          checked={state.acceptedTerms}
          onChange={(e) => onChange({ acceptedTerms: e.target.checked })}
          className="mt-1 h-4 w-4 accent-[color:var(--color-gold)]"
        />
        Acepto los términos, la política de tratamiento de datos y la política de reservas y
        cancelaciones.
      </label>

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          Atrás
        </Button>
        <Button type="submit" disabled={!valid}>
          Continuar
        </Button>
      </div>
    </form>
  );
}
