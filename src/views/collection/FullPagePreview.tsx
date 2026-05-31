import { ArrowUp, ArrowDown } from "lucide-react";
import type { EntityContract, EntityPreviewMetadata } from "./types";
import { PreviewBreadcrumb } from "./preview/PreviewBreadcrumb";
import type { CollectionEdge, FocusTrailEntry, SingleTargetEdge, SetTargetEdge } from "./navigation/types";

type Props<TItem, TProperty extends string> = {
  item: TItem;
  entity: EntityContract<TItem, TProperty>;
  index: number;
  total: number;
  canMovePrevious: boolean;
  canMoveNext: boolean;
  onBack: () => void;
  onMovePrevious: () => void;
  onMoveNext: () => void;
  focusTrail?: FocusTrailEntry<TItem>[];
  onPickFocusCrumb?: (index: number) => void;
  edges?: CollectionEdge<TItem>[];
  onOpenSingleEdge?: (edge: SingleTargetEdge<TItem>) => void;
  onOpenSetEdge?: (edge: SetTargetEdge<TItem>) => void;
};

export function FullPagePreview<TItem, TProperty extends string>({
  item, entity, index, total, canMovePrevious, canMoveNext, onBack, onMovePrevious, onMoveNext,
  focusTrail, onPickFocusCrumb, edges, onOpenSingleEdge, onOpenSetEdge,
}: Props<TItem, TProperty>) {
  const EntityDetail = entity.Detail;
  const noun = entity.detailLabel ?? entity.id;
  const previewMetadata: EntityPreviewMetadata = {
    surface: "full-page",
    width: null,
    height: null,
    sizeClass: "roomy",
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
        <button
          type="button"
          aria-label="Back to list (Esc)"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-subtext hover:bg-surface hover:text-text"
        >
          Back to list (Esc)
        </button>
        <div className="flex-1" />
        <span className="text-xs tabular-nums text-subtext">{index + 1} of {total}</span>
        <button
          type="button"
          aria-label={`Previous ${noun}`}
          disabled={!canMovePrevious}
          onClick={onMovePrevious}
          className="inline-flex h-control-sm items-center justify-center rounded px-1.5 text-subtext hover:bg-surface hover:text-text disabled:cursor-default disabled:opacity-40"
        >
          <ArrowUp size={12} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Next ${noun}`}
          disabled={!canMoveNext}
          onClick={onMoveNext}
          className="inline-flex h-control-sm items-center justify-center rounded px-1.5 text-subtext hover:bg-surface hover:text-text disabled:cursor-default disabled:opacity-40"
        >
          <ArrowDown size={12} aria-hidden />
        </button>
        <span
          aria-label="Keyboard navigation hint"
          className="text-xs text-subtext"
        >
          j / k
        </span>
      </div>
      <PreviewBreadcrumb trail={focusTrail} onPickCrumb={onPickFocusCrumb} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EntityDetail
          item={item}
          preview={previewMetadata}
          edges={edges}
          onOpenSingleEdge={onOpenSingleEdge}
          onOpenSetEdge={onOpenSetEdge}
        />
      </div>
    </div>
  );
}
