import { useEffect, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { ArrowUp, ArrowDown, X } from "lucide-react";
import { IconButton } from "../../ui/buttons/IconButton";
import type { EntityContract } from "./types";
import type { PreviewSurface } from "./ViewConfig";
import {
  DEFAULT_BOTTOM_PEEK_HEIGHT,
  DEFAULT_SIDE_PEEK_WIDTH,
  MAX_BOTTOM_PEEK_HEIGHT,
  MAX_SIDE_PEEK_WIDTH,
  MIN_BOTTOM_PEEK_HEIGHT,
  MIN_SIDE_PEEK_WIDTH,
  PREVIEW_RESIZE_KEYBOARD_LARGE_STEP,
  PREVIEW_RESIZE_KEYBOARD_STEP,
  clampPreviewSize,
  previewSizeClass,
} from "./previewSizing";
import { useElementSize } from "./useElementSize";

type DetailSurface = Extract<PreviewSurface, "side-peek" | "bottom-peek">;

type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startSize: number;
};

type Props<TItem, TProperty extends string> = {
  item: TItem;
  entity: EntityContract<TItem, TProperty>;
  surface: DetailSurface;
  sidePeekWidth: number;
  bottomPeekHeight: number;
  index: number;
  total: number;
  canMovePrevious: boolean;
  canMoveNext: boolean;
  onClose: () => void;
  onMovePrevious: () => void;
  onMoveNext: () => void;
  onResizeCommit: (surface: DetailSurface, size: number) => void;
};

export function Detail<TItem, TProperty extends string>({
  item,
  entity,
  surface,
  sidePeekWidth,
  bottomPeekHeight,
  index,
  total,
  canMovePrevious,
  canMoveNext,
  onClose,
  onMovePrevious,
  onMoveNext,
  onResizeCommit,
}: Props<TItem, TProperty>) {
  const EntityDetail = entity.Detail;
  const noun = entity.detailLabel ?? entity.id;
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);

  const configuredSize = surface === "side-peek" ? sidePeekWidth : bottomPeekHeight;
  const [localSize, setLocalSize] = useState(() => clampPreviewSize(surface, configuredSize));
  const [dragState, setDragState] = useState<DragState | null>(null);

  useEffect(() => {
    setLocalSize(clampPreviewSize(surface, configuredSize));
    setDragState(null);
  }, [surface, configuredSize]);

  const minSize = surface === "side-peek" ? MIN_SIDE_PEEK_WIDTH : MIN_BOTTOM_PEEK_HEIGHT;
  const maxSize = surface === "side-peek" ? MAX_SIDE_PEEK_WIDTH : MAX_BOTTOM_PEEK_HEIGHT;
  const orientation = surface === "side-peek" ? "vertical" : "horizontal";
  const resizeCursorClass = surface === "side-peek" ? "cursor-col-resize" : "cursor-row-resize";
  const splitterPositionClass = surface === "side-peek"
    ? "left-0 top-0 h-full w-2 -translate-x-1"
    : "left-0 top-0 h-2 w-full -translate-y-1";

  const [contentRef, measuredSize] = useElementSize<HTMLDivElement>();
  const sizeClass = previewSizeClass(surface, localSize);
  const previewWidth = measuredSize.width ?? (surface === "side-peek" ? localSize : null);
  const previewHeight = measuredSize.height ?? (surface === "bottom-peek" ? localSize : null);
  const previewMetadata = { surface, width: previewWidth, height: previewHeight, sizeClass };

  const frameClass = surface === "side-peek"
    ? "shrink-0 border-l border-border"
    : "shrink-0 border-t border-border";
  const frameStyle = surface === "side-peek"
    ? { width: `${localSize}px` }
    : { height: `${localSize}px` };

  function commitSize(nextSize: number) {
    const clamped = clampPreviewSize(surface, nextSize);
    setLocalSize(clamped);
    onResizeCommit(surface, clamped);
  }

  function sizeFromPointer(event: PointerEvent<HTMLElement>, drag: DragState): number {
    if (surface === "side-peek") {
      return clampPreviewSize(surface, drag.startSize - (event.clientX - drag.startClientX));
    }
    return clampPreviewSize(surface, drag.startSize - (event.clientY - drag.startClientY));
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startSize: localSize,
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    setLocalSize(sizeFromPointer(event, dragState));
  }

  function handlePointerEnd(event: PointerEvent<HTMLButtonElement>) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const nextSize = sizeFromPointer(event, dragState);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragState(null);
    commitSize(nextSize);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? PREVIEW_RESIZE_KEYBOARD_LARGE_STEP : PREVIEW_RESIZE_KEYBOARD_STEP;
    let nextSize: number | null = null;

    if (surface === "side-peek") {
      if (event.key === "ArrowLeft") nextSize = localSize + step;
      if (event.key === "ArrowRight") nextSize = localSize - step;
    } else {
      if (event.key === "ArrowUp") nextSize = localSize + step;
      if (event.key === "ArrowDown") nextSize = localSize - step;
    }

    if (event.key === "Home") nextSize = surface === "side-peek" ? DEFAULT_SIDE_PEEK_WIDTH : DEFAULT_BOTTOM_PEEK_HEIGHT;
    if (event.key === "End") nextSize = maxSize;
    if (nextSize === null) return;
    event.preventDefault();
    event.stopPropagation();
    commitSize(nextSize);
  }

  return (
    <aside
      aria-label={`${Noun} detail`}
      className={`${frameClass} relative flex flex-col overflow-hidden bg-background`}
      style={frameStyle as CSSProperties}
    >
      <button
        type="button"
        role="separator"
        aria-label={`Resize ${noun} detail`}
        aria-orientation={orientation}
        aria-valuemin={minSize}
        aria-valuemax={maxSize}
        aria-valuenow={localSize}
        className={`absolute z-10 ${splitterPositionClass} ${resizeCursorClass} touch-none bg-transparent transition-colors hover:bg-border/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onKeyDown={handleKeyDown}
      />
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
