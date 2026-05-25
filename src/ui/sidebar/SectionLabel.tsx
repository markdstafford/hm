import type { ReactNode } from "react";

type Props = { children: ReactNode; className?: string };

export function SectionLabel({ children, className = "" }: Props) {
  return (
    <div
      className={`px-3 py-1 text-xs text-subtext font-medium tracking-wide ${className}`}
      style={{ fontVariantCaps: "all-small-caps" }}
    >
      {children}
    </div>
  );
}
