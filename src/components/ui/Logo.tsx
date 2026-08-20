export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg width="34" height="34" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <circle cx="50" cy="50" r="42" stroke="var(--color-gold)" strokeWidth="3" />
        <path
          d="M50 26c14 8 18 20 18 30 0 12-8 20-18 20s-18-8-18-20c0-10 4-22 18-30Z"
          stroke="var(--color-gold)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M50 40v36" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="font-display text-2xl tracking-[0.2em] text-cream uppercase">Respiro</span>
    </div>
  );
}
