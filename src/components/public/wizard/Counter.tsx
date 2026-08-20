export function Counter({
  label,
  value,
  onChange,
  min = 0,
  max = 15,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
      <span className="text-cream">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Disminuir ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-cream hover:border-gold hover:text-gold disabled:opacity-30"
        >
          −
        </button>
        <span className="w-6 text-center text-cream" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          aria-label={`Aumentar ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-cream hover:border-gold hover:text-gold disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}
