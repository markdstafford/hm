import { createElement, type ReactNode } from "react";

type Props = {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: ReactNode;
  className?: string;
};

const SIZES: Record<Props["level"], string> = {
  1: "text-lg font-semibold",
  2: "text-md font-semibold",
  3: "text-base font-semibold",
  4: "text-sm font-semibold",
  5: "text-sm font-medium",
  6: "text-xs font-medium uppercase tracking-wide",
};

export function Heading({ level, children, className = "" }: Props) {
  return createElement(`h${level}`, { className: `text-text ${SIZES[level]} ${className}` }, children);
}
