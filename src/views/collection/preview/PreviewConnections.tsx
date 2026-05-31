import type { KeyboardEvent } from "react";
import { LINK_KIND_META } from "../../../ui/data/linkKindIcons";
import { SecondaryHighlightChip } from "../../../ui/data/SecondaryHighlightChip";
import type {
  CollectionEdge,
  CollectionEdgeDanglingReason,
  SingleTargetEdge,
  SetTargetEdge,
} from "../navigation/types";

type Props<TItem> = {
  edges?: CollectionEdge<TItem>[];
  onOpenSingle?: (edge: SingleTargetEdge<TItem>) => void;
  onOpenSet?: (edge: SetTargetEdge<TItem>) => void;
};

const DANGLING_COPY: Record<CollectionEdgeDanglingReason, string> = {
  "not-ingested": "Not ingested",
  "source-not-configured": "Source not configured",
  "unsupported-target": "Unsupported target",
  unresolved: "Unresolved",
};

function confidenceCopy(confidence: number): string {
  return `${Math.round(confidence * 100)}% related`;
}

function setCountCopy<TItem>(edge: SetTargetEdge<TItem>): string {
  const count = edge.count ?? edge.items?.length;
  if (count === undefined) return "Open set";
  return `${count} ${count === 1 ? "item" : "items"}`;
}

function singleAccessibleName<TItem>(edge: SingleTargetEdge<TItem>, disabledReason?: string): string {
  if (disabledReason) return `${edge.relationship} ${edge.targetRef.displayKey}, ${disabledReason}`;
  return `Open ${edge.relationship} ${edge.targetRef.displayKey}`;
}

function setAccessibleName<TItem>(edge: SetTargetEdge<TItem>, disabledReason?: string): string {
  const count = edge.count ?? edge.items?.length;
  if (disabledReason) return `${edge.label}, ${disabledReason}`;
  if (count === undefined) return `Open ${edge.label}`;
  return `Open ${edge.label}, ${count} ${count === 1 ? "item" : "items"}`;
}

function isSingleDrillable<TItem>(edge: SingleTargetEdge<TItem>): boolean {
  return !!edge.target && !edge.danglingReason;
}

function isSetDrillable<TItem>(edge: SetTargetEdge<TItem>): boolean {
  // Allow partial-drill: navigate to resolved members even when some are unresolved.
  // A set is drillable as long as at least one resolved item is present and no dangling reason is set.
  return Array.isArray(edge.items) && edge.items.length > 0 && !edge.danglingReason;
}

export function PreviewConnections<TItem>({ edges = [], onOpenSingle, onOpenSet }: Props<TItem>) {
  if (edges.length === 0) return null;

  function activate(edge: CollectionEdge<TItem>) {
    if (edge.shape === "single") {
      if (!isSingleDrillable(edge)) return;
      onOpenSingle?.(edge);
      return;
    }
    if (!isSetDrillable(edge)) return;
    onOpenSet?.(edge);
  }

  function handleKeyDown(edge: CollectionEdge<TItem>, event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    activate(edge);
  }

  return (
    <section aria-label="Connections" className="flex flex-col gap-2 border-b border-border pb-3">
      <h3 className="text-sm font-medium text-text">Connections</h3>
      <div className="flex flex-col gap-1">
        {edges.map((edge) => {
          const meta = LINK_KIND_META[edge.kind];
          const Icon = meta.Icon;
          const danglingCopy = edge.danglingReason ? DANGLING_COPY[edge.danglingReason] : undefined;
          const disabled = edge.shape === "single" ? !isSingleDrillable(edge) : !isSetDrillable(edge);
          const accessibleName = edge.shape === "single"
            ? singleAccessibleName(edge, danglingCopy)
            : setAccessibleName(edge, danglingCopy);

          return (
            <button
              key={edge.id}
              type="button"
              aria-label={accessibleName}
              aria-disabled={disabled ? "true" : undefined}
              tabIndex={disabled ? -1 : 0}
              onClick={() => activate(edge)}
              onKeyDown={(event) => handleKeyDown(edge, event)}
              className={`grid grid-cols-[auto_minmax(5.5rem,auto)_1fr_auto] items-center gap-2 rounded px-2 py-1.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                disabled
                  ? "cursor-default text-subtext opacity-60"
                  : "text-text hover:bg-surface"
              }`}
            >
              {!danglingCopy && (
                <span className="inline-flex items-center gap-1 text-xs text-subtext">
                  <Icon size={14} aria-hidden />
                  <span>{meta.label}</span>
                </span>
              )}
              <span className="text-xs text-subtext">{edge.relationship}</span>
              {edge.shape === "single" ? (
                <span className="min-w-0">
                  <span className="font-mono text-xs">{edge.targetRef.displayKey}</span>
                  {edge.targetRef.title && <span className="ml-2 truncate text-subtext">{edge.targetRef.title}</span>}
                </span>
              ) : (
                <span className="min-w-0 truncate">{edge.label}</span>
              )}
              <span className="justify-self-end text-xs text-subtext">
                {danglingCopy ?? (edge.confidence !== undefined ? (
                  <SecondaryHighlightChip>{confidenceCopy(edge.confidence)}</SecondaryHighlightChip>
                ) : edge.shape === "set" ? setCountCopy(edge) : null)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
