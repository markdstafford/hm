import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { Dialog } from "../../ui/overlays/Dialog";
import { KeyboardShortcut } from "../../ui/navigation/KeyboardShortcut";
import { Spinner } from "../../ui/feedback/Spinner";
import { EmptyState } from "../../ui/feedback/EmptyState";
import { previewSizeClass } from "../../views/collection/previewSizing";
import type { CollectionEdge } from "../../views/collection/navigation/types";
import type { EntityPreviewMetadata } from "../../views/collection/types";
import { buildQuickSwitcherResults } from "./search";
import {
  applyQuickSwitcherKey,
  initialQuickSwitcherKeyboardState,
  type QuickSwitcherKeyboardState,
} from "./keyboard";
import type {
  QuickSwitcherNumberedEdge,
  QuickSwitcherResult,
  QuickSwitcherSource,
} from "./types";

export type QuickSwitcherProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: QuickSwitcherSource[];
  initialQuery?: string;
};

function isDrillable<TItem>(edge: CollectionEdge<TItem>): boolean {
  if (edge.danglingReason) return false;
  if (edge.shape === "single") return Boolean(edge.target);
  return Array.isArray(edge.items) && edge.items.length > 0;
}

function numberedEdgesFor<TItem>(result: QuickSwitcherResult<TItem> | null): QuickSwitcherNumberedEdge<TItem>[] {
  if (!result?.source.entity.resolveEdges) return [];
  const edges = result.source.entity.resolveEdges({
    item: result.item.item,
    allItems: result.source.items,
  });
  return edges
    .filter(isDrillable)
    .slice(0, 9)
    .map((edge, index) => ({ number: index + 1, edge }));
}

export function QuickSwitcher({ open, onOpenChange, sources, initialQuery = "" }: QuickSwitcherProps) {
  const [query, setQuery] = useState(initialQuery);
  const [keyboard, setKeyboard] = useState<QuickSwitcherKeyboardState>(() =>
    initialQuickSwitcherKeyboardState(0),
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => buildQuickSwitcherResults({ sources, query }), [sources, query]);
  const activeIndex =
    results.length === 0 ? -1 : Math.min(Math.max(keyboard.activeIndex, 0), results.length - 1);
  const activeResult = activeIndex >= 0 ? results[activeIndex] : null;
  const loading = sources.some((source) => source.loading);
  const sourceError = sources.find((source) => source.error)?.error ?? null;
  const numberedEdges = useMemo(() => numberedEdgesFor(activeResult), [activeResult]);

  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery);
    setKeyboard(initialQuickSwitcherKeyboardState(0));
    window.setTimeout(() => inputRef.current?.focus(), 0);
    // Reset only when the dialog opens; results are intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuery]);

  useEffect(() => {
    setKeyboard((current) => ({
      focusMode: current.focusMode,
      activeIndex:
        results.length > 0 ? Math.min(Math.max(current.activeIndex, 0), results.length - 1) : -1,
    }));
  }, [results.length]);

  function close() {
    onOpenChange(false);
  }

  function openResult(result: QuickSwitcherResult | null): boolean {
    if (!result) return false;
    const opened = result.source.openItem(result.item.item, {
      openPreview: true,
      scopedFallback: true,
    });
    if (opened) close();
    return opened;
  }

  function openNumberedEdge(number: number): boolean {
    const numbered = numberedEdges.find((candidate) => candidate.number === number);
    if (!numbered || !activeResult) return false;
    const edge = numbered.edge;
    let opened = false;
    if (edge.shape === "single") {
      opened = activeResult.source.openSingleEdge?.(edge) ?? false;
    } else {
      opened = activeResult.source.openSetEdge?.(edge) ?? false;
    }
    if (opened) close();
    return opened;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    const next = applyQuickSwitcherKey(keyboard, { key: event.key, resultCount: results.length });
    if (next.action === "none") return;

    event.preventDefault();
    event.stopPropagation();
    setKeyboard(next.state);

    if (next.action === "focus-results") resultsRef.current?.focus();
    if (next.action === "focus-input") inputRef.current?.focus();
    if (next.action === "open-result") openResult(activeResult);
    if (next.action === "open-edge") openNumberedEdge(Number(event.key));
  }

  function handlePointerActive(index: number) {
    setKeyboard({ focusMode: keyboard.focusMode, activeIndex: index });
  }

  const EntityDetail = activeResult?.source.entity.Detail;
  const previewEdges = activeResult?.source.entity.resolveEdges
    ? activeResult.source.entity.resolveEdges({
        item: activeResult.item.item,
        allItems: activeResult.source.items,
      })
    : [];
  const previewMetadata: EntityPreviewMetadata = {
    surface: "quick-switcher",
    width: 480,
    height: null,
    sizeClass: previewSizeClass("side-peek", 360),
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="flex max-h-[82vh] w-[min(68rem,92vw)] flex-col gap-0 overflow-hidden p-0">
        <Dialog.Title className="sr-only">Quick switcher</Dialog.Title>
        <div className="flex h-12 items-center gap-3 border-b border-border px-3">
          <Search size={14} aria-hidden className="text-subtext" />
          <input
            ref={inputRef}
            role="combobox"
            aria-label="Search items"
            aria-controls="quick-switcher-results"
            aria-expanded={open}
            aria-activedescendant={
              activeResult ? `quick-switcher-result-${activeResult.id}` : undefined
            }
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setKeyboard({ focusMode: "input", activeIndex: 0 });
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search items…"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            className="h-control-lg min-w-0 flex-1 bg-transparent text-md text-text outline-none placeholder:text-subtext"
          />
          <div className="hidden items-center gap-1 text-xs text-subtext md:flex">
            <span>↑↓/jk move</span>
            <span aria-hidden>·</span>
            <span>↵ open</span>
            <span aria-hidden>·</span>
            <span>1–9 open connection</span>
            <span aria-hidden>·</span>
            <KeyboardShortcut binding="⌘+k" />
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(18rem,0.9fr)_minmax(24rem,1.1fr)]">
          <div className="min-h-[22rem] border-b border-border md:border-b-0 md:border-r">
            <div
              id="quick-switcher-results"
              ref={resultsRef}
              role="listbox"
              aria-label="Quick switcher results"
              tabIndex={-1}
              onKeyDown={handleKeyDown}
              className="h-full overflow-y-auto p-2 focus:outline-none"
            >
              {loading && (
                <div className="px-2 py-2">
                  <Spinner label="Loading local items" />
                </div>
              )}
              {sourceError && (
                <p role="alert" className="px-2 py-2 text-sm text-subtext">
                  Some local items could not be loaded.
                </p>
              )}
              {!loading && results.length === 0 && query.trim() && (
                <EmptyState
                  title={`No local items match "${query}"`}
                  description="Try a key, title, project, status, label, or assignee."
                />
              )}
              {!loading && results.length === 0 && !query.trim() && (
                <EmptyState
                  title="Search local items"
                  description="Type a key or title fragment to find an item."
                />
              )}
              {results.map((result, index) => {
                const selected = index === activeIndex;
                return (
                  <button
                    key={result.id}
                    id={`quick-switcher-result-${result.id}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    aria-label={`${result.item.kindLabel} ${result.item.primaryLabel} ${result.item.title} ${result.item.contextLabel ?? ""}`.trim()}
                    onMouseEnter={() => handlePointerActive(index)}
                    onFocus={() => handlePointerActive(index)}
                    onClick={() => openResult(result)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${selected ? "bg-primary text-on-primary" : "text-text hover:bg-surface"}`}
                  >
                    <span
                      className={`shrink-0 rounded border px-1.5 py-0.5 text-xs ${selected ? "border-on-primary/50" : "border-border text-subtext"}`}
                    >
                      {result.item.kindLabel}
                    </span>
                    <span className="shrink-0 font-mono text-xs">{result.item.primaryLabel}</span>
                    <span className="min-w-0 flex-1 truncate">{result.item.title}</span>
                    {result.item.contextLabel && (
                      <span
                        className={`hidden max-w-32 truncate text-xs lg:inline ${selected ? "text-on-primary/80" : "text-subtext"}`}
                      >
                        {result.item.contextLabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <section
            aria-label="Preview"
            role="region"
            className="min-h-[22rem] overflow-y-auto bg-background"
          >
            {!activeResult && (
              <div className="flex h-full items-center justify-center p-6 text-sm text-subtext">
                Preview appears here.
              </div>
            )}
            {activeResult && EntityDetail && (
              <div
                data-preview-surface="quick-switcher"
                data-preview-size="compact"
                className="min-h-full"
                style={{ "--preview-width": "480px" } as CSSProperties}
              >
                <EntityDetail
                  item={activeResult.item.item}
                  preview={previewMetadata}
                  edges={previewEdges}
                  onOpenSingleEdge={(edge) => {
                    const opened = activeResult.source.openSingleEdge?.(edge) ?? false;
                    if (opened) close();
                  }}
                  onOpenSetEdge={(edge) => {
                    const opened = activeResult.source.openSetEdge?.(edge) ?? false;
                    if (opened) close();
                  }}
                />
              </div>
            )}
            {activeResult && !EntityDetail && (
              <div className="flex h-full items-center justify-center p-6 text-sm text-subtext">
                {activeResult.source.previewUnavailable ?? "Preview unavailable for this item type"}
              </div>
            )}
          </section>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
