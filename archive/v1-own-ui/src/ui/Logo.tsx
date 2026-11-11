export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`logo ${compact ? "is-compact" : ""}`}>
      <svg width={compact ? 22 : 28} height={compact ? 22 : 28} viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="14" r="12" fill="none" stroke="var(--ochre)" strokeWidth="1.6" />
        <path d="M8 18 L14 8 L20 18 Z" fill="var(--terra)" />
        <circle cx="21" cy="8" r="2" fill="var(--ochre)" />
      </svg>
      <b>Mots B2</b>
      {!compact && <small>法语词图</small>}
    </span>
  );
}
