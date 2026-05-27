import type { ReactNode } from "react";
import type { CollectionView } from "./views/types";
import { orderedViews } from "./views/seed";

export type ViewChipsProps = {
  views: CollectionView[];
  activeViewId: string | null;
  onPick: (viewId: string) => void;
  onCreate: () => void;
  renderChip?: (view: CollectionView, chip: ReactNode) => ReactNode;
};

function chipClass(active: boolean): string {
  return [
    "inline-flex h-control-sm max-w-48 shrink-0 items-center rounded-full px-2 text-xs font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
    active
      ? "bg-primary text-on-primary"
      : "border border-border bg-surface text-text hover:bg-surface-1",
  ].join(" ");
}

export function ViewChips({ views, activeViewId, onPick, onCreate, renderChip }: ViewChipsProps) {
  return (
    <div aria-label="Collection views" className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {orderedViews(views).map((view) => {
        const active = view.id === activeViewId;
        const chip = (
          <button
            key={view.id}
            type="button"
            aria-current={active ? "true" : undefined}
            data-active={active ? "true" : undefined}
            className={chipClass(active)}
            onClick={() => {
              if (!active) onPick(view.id);
            }}
          >
            <span className="truncate">{view.displayName}</span>
          </button>
        );
        return renderChip ? <span key={view.id}>{renderChip(view, chip)}</span> : chip;
      })}
      <button
        type="button"
        aria-label="Create named view"
        className="inline-flex h-control-sm shrink-0 items-center rounded-full border border-border bg-surface px-2 text-xs font-medium text-text transition-colors hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        onClick={onCreate}
      >
        +
      </button>
    </div>
  );
}
