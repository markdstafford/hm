import type { ReactNode } from "react";

type Tone = "neutral" | "primary" | "green" | "red" | "yellow" | "mauve" | "peach";

const TONE: Record<Tone, string> = {
  neutral: "bg-surface text-subtext",
  primary: "bg-primary/15 text-primary",
  green: "bg-green/15 text-green",
  red: "bg-red/15 text-red",
  yellow: "bg-yellow/15 text-yellow",
  mauve: "bg-mauve/15 text-mauve",
  peach: "bg-peach/15 text-peach",
};

type Props = { children: ReactNode; tone?: Tone; className?: string };

export function Badge({ children, tone = "neutral", className = "" }: Props) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 h-control-sm text-xs font-medium ${TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}
