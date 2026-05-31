import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  "data-confidence"?: "high" | "low";
};

export function SecondaryHighlightChip({
  children,
  className = "",
  "aria-label": ariaLabel,
  "data-confidence": dataConfidence,
}: Props) {
  return (
    <span
      aria-label={ariaLabel}
      data-confidence={dataConfidence}
      className={`inline-flex h-control-sm items-center rounded border border-[var(--color-secondary-highlight-border)] bg-[var(--color-secondary-highlight-bg)] px-1.5 text-xs font-medium tabular-nums text-[var(--color-secondary-highlight-text)] ${className}`}
    >
      {children}
    </span>
  );
}
