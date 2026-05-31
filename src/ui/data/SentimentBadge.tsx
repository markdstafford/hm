import type { ReactNode } from "react";

export type SentimentTone = "good" | "ok" | "bad";

type Props = {
  tone: SentimentTone;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
};

const TONE_CLASSES: Record<SentimentTone, string> = {
  good: "border-[var(--color-sentiment-good-border)] bg-[var(--color-sentiment-good-bg)] text-[var(--color-sentiment-good-text)]",
  ok: "border-[var(--color-sentiment-ok-border)] bg-[var(--color-sentiment-ok-bg)] text-[var(--color-sentiment-ok-text)]",
  bad: "border-[var(--color-sentiment-bad-border)] bg-[var(--color-sentiment-bad-bg)] text-[var(--color-sentiment-bad-text)]",
};

export function SentimentBadge({ tone, children, className = "", "aria-label": ariaLabel }: Props) {
  return (
    <span
      aria-label={ariaLabel}
      data-sentiment={tone}
      className={`inline-flex h-control-sm items-center rounded border px-1.5 text-xs font-medium ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
