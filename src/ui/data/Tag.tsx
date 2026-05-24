import { X } from "lucide-react";
import type { ReactNode } from "react";

type Props = { children: ReactNode; onRemove?: () => void; className?: string };

export function Tag({ children, onRemove, className = "" }: Props) {
  const label = typeof children === "string" ? children : "tag";
  return (
    <span className={`inline-flex items-center gap-1 rounded bg-surface px-1.5 h-control-sm text-xs text-text ${className}`}>
      <span>{children}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
          className="text-subtext hover:text-text"
        >
          <X size={11} aria-hidden />
        </button>
      )}
    </span>
  );
}
