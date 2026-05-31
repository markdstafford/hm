import type { CSSProperties } from "react";
import { ArrowUp, ArrowDown, X } from "lucide-react";
import { IconButton } from "../../ui/buttons/IconButton";
import type { EntityContract } from "./types";
import type { PreviewSurface } from "./ViewConfig";
import { previewSizeClass } from "./previewSizing";
import { useElementSize } from "./useElementSize";

type DetailSurface = Extract<PreviewSurface, "side-peek" | "bottom-peek">;

type Props<TItem, TProperty extends string> = {
  item: TItem;
  entity: EntityContract<TItem, TProperty>;
  surface: DetailSurface;
  index: number;
  total: number;
  canMovePrevious: boolean;
  canMoveNext: boolean;
  onClose: () => void;
  onMovePrevious: () => void;
  onMoveNext: () => void;
  sidePeekWidth: number;
  bottomPeekHeight: number;
  onResizeCommit: (surface: DetailSurface, size: number) => void;
};

export function Detail<TItem, TProperty extends string>({
  item, entity, surface, index, total, canMovePrevious, canMoveNext, onClose, onMovePrevious, onMoveNext,
  sidePeekWidth, bottomPeekHeight,
}: Props<TItem, TProperty>) {
  const EntityDetail = entity.Detail;
  const [contentRef, measuredSize] = useElementSize<HTMLDivElement>();
  const activeSize = surface === "side-peek" ? sidePeekWidth : bottomPeekHeight;
  const sizeClass = previewSizeClass(surface, activeSize);
  const previewWidth = measuredSize.width ?? (surface === "side-peek" ? activeSize : null);
  const previewHeight = measuredSize.height ?? (surface === "bottom-peek" ? activeSize : null);
  const previewMetadata = { surface, width: previewWidth, height: previewHeight, sizeClass };
  const frameClass = surface === "side-peek"
    ? "shrink-0 border-l border-border"
    : "shrink-0 border-t border-border";
  const frameStyle = surface === "side-peek"
    ? { width: `${activeSize}px` }
    : { height: `${activeSize}px` };
  const noun = entity.detailLabel ?? entity.id;
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);

  return (
    <aside
      aria-label={`${Noun} detail`}
      className={`${frameClass} flex flex-col overflow-hidden bg-background`}
      style={frameStyle as CSSProperties}
    >
      <div className="flex items-center gap-2 px-3 py-2 shrink-0 border-b border-border">
        <span className="mr-auto text-xs tabular-nums text-subtext">{index + 1} of {total}</span>
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
        <IconButton label={`Close ${noun} detail`} onClick={onClose}>
          <X size={12} aria-hidden />
        </IconButton>
      </div>
      <div
        ref={contentRef}
        data-testid="preview-content-frame"
        data-preview-surface={surface}
        data-preview-size={sizeClass}
        className="flex-1 overflow-y-auto"
        style={{
          "--preview-width": previewWidth === null ? undefined : `${previewWidth}px`,
          "--preview-height": previewHeight === null ? undefined : `${previewHeight}px`,
        } as CSSProperties}
      >
        <EntityDetail item={item} preview={previewMetadata} />
      </div>
    </aside>
  );
}
