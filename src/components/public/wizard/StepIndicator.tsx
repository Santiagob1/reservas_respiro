import { STEP_LABELS } from "./types";

export function StepIndicator({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto pb-1 text-xs sm:text-sm">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <li key={label} className="flex shrink-0 items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                active
                  ? "border-gold bg-gold text-ink font-semibold"
                  : done
                    ? "border-gold text-gold"
                    : "border-line text-muted"
              }`}
              aria-current={active ? "step" : undefined}
            >
              {n}
            </span>
            <span className={active ? "text-cream" : "text-muted"}>{label}</span>
            {n < STEP_LABELS.length && <span className="mx-1 h-px w-4 bg-line" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
