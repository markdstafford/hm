import { ChevronRight } from "lucide-react";
import type { FocusTrailEntry } from "../navigation/types";

type Props<TItem> = {
  trail?: FocusTrailEntry<TItem>[];
  onPickCrumb?: (index: number) => void;
};

export function PreviewBreadcrumb<TItem>({ trail = [], onPickCrumb }: Props<TItem>) {
  if (trail.length <= 1) return null;

  return (
    <nav
      aria-label="Preview focus path"
      className="flex min-h-control-base shrink-0 items-center gap-1 overflow-hidden border-b border-border px-3 py-1.5 text-xs"
    >
      {trail.map((entry, index) => {
        const isCurrent = index === trail.length - 1;
        return (
          <span key={`${entry.label}:${index}`} className="flex min-w-0 items-center gap-1">
            {index > 0 && <ChevronRight size={11} aria-hidden className="shrink-0 opacity-50" />}
            {isCurrent ? (
              <span aria-current="page" className="truncate font-medium text-text">
                {entry.label}
              </span>
            ) : (
              <button
                type="button"
                aria-label={`Return to ${entry.label}`}
                onClick={() => onPickCrumb?.(index)}
                className="truncate rounded text-subtext hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {entry.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
