type Props = { value: number; className?: string };

export function ConfidenceChip({ value, className = "" }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const high = clamped >= 85;
  return (
    <span
      data-confidence={high ? "high" : "low"}
      className={`inline-flex items-center rounded px-1.5 h-control-sm text-xs font-medium tabular-nums ${
        high ? "bg-primary/15 text-primary" : "bg-surface text-subtext"
      } ${className}`}
    >
      <span>{clamped}%</span>
    </span>
  );
}
