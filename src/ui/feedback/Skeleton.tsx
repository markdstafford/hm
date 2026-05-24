type Props = { width?: number | string; height?: number | string; className?: string };

export function Skeleton({ width = "100%", height = 12, className = "" }: Props) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-pulse rounded bg-surface ${className}`}
      style={{ width, height }}
    />
  );
}
