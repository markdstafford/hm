type Props = { label?: string; size?: number; className?: string };

export function Spinner({ label, size = 14, className = "" }: Props) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label}
      className={`inline-block animate-spin rounded-full border-2 border-border border-t-primary ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
