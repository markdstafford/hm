import type { ReactNode } from "react";

export function InlineCode({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <code className={`font-mono text-[0.85em] bg-surface text-text px-1 rounded ${className}`}>
      {children}
    </code>
  );
}
