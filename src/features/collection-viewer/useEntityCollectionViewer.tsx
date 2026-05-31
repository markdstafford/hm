import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { commands } from "../../bindings";
import { loadPreferences, savePreferences } from "../../preferences/storage";
import type { AppPreferences } from "../../preferences";
import { Spinner } from "../../ui/feedback/Spinner";
import { EmptyState } from "../../ui/feedback/EmptyState";
import { Body } from "../../views/collection/Body";
import { bucketCollectionItems, flattenBucketedGroups } from "../../views/collection/bucket";
import { sortCollectionItems } from "../../views/collection/sort";
import { filterCollectionItems } from "../../views/collection/filter/predicates";
import { CollectionHeader } from "../../views/collection/CollectionHeader";
import { Detail } from "../../views/collection/Detail";
import { FullPagePreview } from "../../views/collection/FullPagePreview";
import type { EntityContract, PropertyConfig } from "../../views/collection/types";
import type { CollectionView } from "../../views/collection/views/types";
import {
  fromCollectionViewRecord,
  toCollectionViewSaveInput,
} from "../../views/collection/views/types";
import {
  activeViewPreferencePatch,
  createFallbackView,
  duplicateViewDraft,
  nextPosition,
  orderedViews,
  pickActiveViewId,
  seedCollectionViews,
  uniqueUntitledName,
} from "../../views/collection/views/seed";
import { normalizeViewConfig, patchViewConfig } from "../../views/collection/ViewConfig";
import type { ViewConfig } from "../../views/collection/ViewConfig";
import { buildConfigPatchView, buildRenameView } from "./viewConfigPersistence";
import { ViewSettingsMenu } from "../../views/collection/menu/ViewSettingsMenu";
import { useKeyboardNavigation } from "../../views/collection/useKeyboardNavigation";
import { useSelection } from "../../views/collection/selection/useSelection";
import {
  appendFocusTarget,
  currentFocusItem,
  initializeFocusTrail,
  resetFocusTrail,
  truncateFocusTrail,
} from "../../views/collection/navigation/focusTrail";
import type {
  ActiveCollectionRoot,
  CollectionEdge,
  FocusTrailEntry,
  SingleTargetEdge,
  SetTargetEdge,
} from "../../views/collection/navigation/types";
import { ReRootBanner } from "../../views/collection/ReRootBanner";
import {
  createBaseRoot,
  pushScopedRoot,
  returnToPreviousRoot,
} from "../../views/collection/navigation/rerootStack";

const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function newViewId(entityKind: string): string {
  return `${entityKind}-view-${Date.now()}`;
}

export type PartialFailure = { source: string; message: string };

export type EntityCollectionCopy = {
  loadingLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  errorTitle: string;
  errorDescription?: string;
};

export type UseEntityCollectionViewerArgs<TItem, TProperty extends string> = {
  /** True when the collection viewer is the focused page. Gates keyboard nav. */
  active: boolean;
  entity: EntityContract<TItem, TProperty>;
  items: TItem[];
  loading: boolean;
  error: string | null;
  copy: EntityCollectionCopy;
  partialFailures?: PartialFailure[];
  retry?: () => void;
};

export type UseEntityCollectionViewerResult<TItem = unknown> = {
  /** Goes into the AppShell's `mainHeader` slot. */
  header: ReactNode;
  /** Goes into the AppShell's `mainContent` slot. */
  body: ReactNode;
  /**
   * Select an item by its entity id. If the item is hidden by the active
   * view's filters, optionally pushes a scoped root containing just that
   * item so the selection is visible.
   * Returns `true` if the id resolved to a known item, `false` otherwise.
   */
  openItemById: (
    id: string,
    options?: { openPreview?: boolean; scopedFallback?: boolean },
  ) => boolean;
  /**
   * Open a single-target edge through the same path used by the in-preview
   * focus-drill button. Returns `false` if the edge has no target or is
   * dangling, `true` otherwise.
   */
  openSingleEdge: (edge: SingleTargetEdge<TItem>) => boolean;
  /**
   * Re-root the list into a set edge. Returns `false` for dangling or empty
   * set edges, `true` otherwise.
   */
  openSetEdge: (edge: SetTargetEdge<TItem>) => boolean;
};

export function useEntityCollectionViewer<TItem, TProperty extends string>({
  active,
  entity,
  items,
  loading,
  error,
  copy,
  partialFailures,
  retry,
}: UseEntityCollectionViewerArgs<TItem, TProperty>): UseEntityCollectionViewerResult<TItem> {
  const rowSelection = useSelection();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(new Set());
  const [views, setViews] = useState<CollectionView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<AppPreferences>({});
  const [viewsLoading, setViewsLoading] = useState(true);
  const [viewError, setViewError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focusTrail, setFocusTrail] = useState<FocusTrailEntry<TItem>[]>([]);
  const [rootStack, setRootStack] = useState<ActiveCollectionRoot<TItem>[]>([]);

  const getFocusLabel = useCallback(
    (item: TItem) => {
      if (entity.getFocusLabel) {
        const label = entity.getFocusLabel(item);
        if (label?.trim()) return label;
      }
      const keyProperty = entity.properties.find((p) => p.id === ("key" as TProperty));
      if (keyProperty) {
        const rendered = keyProperty.renderCell({ item, property: keyProperty.id });
        if (typeof rendered === "string" && rendered.trim()) return rendered;
      }
      return entity.getId(item);
    },
    [entity],
  );

  const activeView = views.find((view) => view.id === activeViewId) ?? null;

  const activeConfig = useMemo(
    () => normalizeViewConfig(activeView?.config, entity),
    [activeView?.config, entity],
  );

  const activeRoot = useMemo(
    () =>
      rootStack.length > 0
        ? rootStack[rootStack.length - 1]
        : createBaseRoot(items, selectedId, previewOpen),
    [rootStack, items, selectedId, previewOpen],
  );

  const rootItems = activeRoot.base ? items : activeRoot.items;

  useEffect(() => {
    if (rootStack.length === 0) return;
    const baseIds = new Set(items.map((item) => entity.getId(item)));
    setRootStack((current) =>
      current.map((root) => {
        if (!root.base) return root;
        const selectedStillExists = root.selectedId ? baseIds.has(root.selectedId) : false;
        return {
          ...root,
          items,
          selectedId: selectedStillExists ? root.selectedId : null,
          previewOpen: selectedStillExists ? root.previewOpen : false,
        };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, entity, rootStack.length]);

  const filteredItems = useMemo(
    () => filterCollectionItems({ items: rootItems, entity, filters: activeConfig.filters }),
    [rootItems, entity, activeConfig.filters],
  );

  const sortedItems = useMemo(
    () => sortCollectionItems(filteredItems, entity, activeConfig.sort),
    [filteredItems, entity, activeConfig.sort],
  );

  const groupedItems = useMemo(
    () =>
      activeConfig.group.property === null
        ? []
        : bucketCollectionItems({
            items: sortedItems,
            entity,
            group: activeConfig.group,
          }),
    [sortedItems, entity, activeConfig.group],
  );

  const displayItems = useMemo(
    () =>
      activeConfig.group.property === null
        ? sortedItems
        : flattenBucketedGroups(groupedItems, { collapsedGroupKeys }),
    [activeConfig.group.property, collapsedGroupKeys, groupedItems, sortedItems],
  );

  useEffect(() => {
    setCollapsedGroupKeys(new Set());
  }, [activeConfig.group.property]);

  useEffect(() => {
    if (!selectedId) return;
    if (displayItems.some((item) => entity.getId(item) === selectedId)) return;
    const first = displayItems[0];
    setSelectedId(first ? entity.getId(first) : null);
    // Sync the focus trail so the preview doesn't show a filtered-out item
    if (first) {
      setFocusTrail((current) => resetFocusTrail(current, first, getFocusLabel, entity.getId));
    } else {
      setFocusTrail([]);
    }
  }, [displayItems, selectedId, entity, getFocusLabel]);

  const selectedIndex = useMemo(
    () =>
      selectedId
        ? displayItems.findIndex((item) => entity.getId(item) === selectedId)
        : -1,
    [displayItems, selectedId, entity],
  );

  const selectedItem: TItem | null =
    selectedIndex >= 0 ? displayItems[selectedIndex] : null;
  const canMovePrevious = selectedIndex > 0;
  const canMoveNext =
    selectedIndex >= 0 && selectedIndex < displayItems.length - 1;

  const previewFocusItem = currentFocusItem(focusTrail) ?? selectedItem;

  const previewEdges: CollectionEdge<TItem>[] = useMemo(
    () => previewFocusItem && entity.resolveEdges
      ? entity.resolveEdges({ item: previewFocusItem, allItems: items })
      : [],
    [entity, previewFocusItem, items],
  );

  const movePrevious = useCallback(() => {
    if (selectedIndex <= 0) return;
    const nextItem = displayItems[selectedIndex - 1];
    setSelectedId(entity.getId(nextItem));
    setFocusTrail((current) => resetFocusTrail(current, nextItem, getFocusLabel, entity.getId));
  }, [displayItems, selectedIndex, entity, getFocusLabel]);

  const moveNext = useCallback(() => {
    if (selectedIndex < 0 || selectedIndex >= displayItems.length - 1) return;
    const nextItem = displayItems[selectedIndex + 1];
    setSelectedId(entity.getId(nextItem));
    setFocusTrail((current) => resetFocusTrail(current, nextItem, getFocusLabel, entity.getId));
  }, [displayItems, selectedIndex, entity, getFocusLabel]);

  const selectFirst = useCallback(() => {
    if (displayItems.length === 0) return;
    const nextItem = displayItems[0];
    setSelectedId(entity.getId(nextItem));
    setFocusTrail((current) => resetFocusTrail(current, nextItem, getFocusLabel, entity.getId));
  }, [displayItems, entity, getFocusLabel]);

  const selectLast = useCallback(() => {
    if (displayItems.length === 0) return;
    const nextItem = displayItems[displayItems.length - 1];
    setSelectedId(entity.getId(nextItem));
    setFocusTrail((current) => resetFocusTrail(current, nextItem, getFocusLabel, entity.getId));
  }, [displayItems, entity, getFocusLabel]);

  const toggleGroupCollapsed = useCallback((bucketKey: string) => {
    setCollapsedGroupKeys((current) => {
      const next = new Set(current);
      if (next.has(bucketKey)) next.delete(bucketKey);
      else next.add(bucketKey);
      return next;
    });
  }, []);

  const openPreview = useCallback(() => setPreviewOpen(true), []);
  const closePreview = useCallback(() => setPreviewOpen(false), []);

  const toggleSelectedRowSelection = useCallback(() => {
    if (selectedId) rowSelection.toggle(selectedId);
  }, [selectedId, rowSelection]);

  useKeyboardNavigation({
    enabled: active && !settingsOpen,
    selectedIndex,
    total: displayItems.length,
    previewOpen,
    onSelectFirst: selectFirst,
    onSelectLast: selectLast,
    onMovePrevious: movePrevious,
    onMoveNext: moveNext,
    onOpenPreview: openPreview,
    onClosePreview: closePreview,
    onToggleSelection: toggleSelectedRowSelection,
  });

  useEffect(() => {
    let cancelled = false;
    async function loadViews() {
      setViewsLoading(true);
      setViewError(null);
      try {
        const [seededViews, prefs] = await Promise.all([
          seedCollectionViews(entity.id, entity.defaultViews),
          loadPreferences(),
        ]);
        if (cancelled) return;
        const safeViews =
          seededViews.length > 0
            ? seededViews
            : [createFallbackView(entity.id)];
        const savedId =
          prefs.collections?.activeViewId?.[entity.id] ?? null;
        const activeId = pickActiveViewId(safeViews, savedId);
        setPreferences(prefs);
        setViews(safeViews);
        setActiveViewId(activeId);
        setViewsLoading(false);
        if (activeId && activeId !== savedId) {
          const result = await savePreferences(
            prefs,
            activeViewPreferencePatch(entity.id, activeId),
          );
          if (!cancelled) setPreferences(result.next);
        }
      } catch (err) {
        if (cancelled) return;
        console.warn("[collection-views] load failed", err);
        setViewError("Could not load collection views");
        setViewsLoading(false);
      }
    }
    loadViews();
    return () => {
      cancelled = true;
    };
  }, [entity.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function persistActive(viewId: string) {
    setActiveViewId(viewId);
    const result = await savePreferences(
      preferences,
      activeViewPreferencePatch(entity.id, viewId),
    );
    setPreferences(result.next);
    if (!result.ok)
      console.warn("[collection-views] active preference save failed", result.error);
  }

  async function saveView(view: CollectionView): Promise<CollectionView> {
    if (!isTauri()) return view;
    const result = await commands.collectionViewSave(
      toCollectionViewSaveInput(view),
    );
    if (result.status === "error") throw new Error(result.error);
    return fromCollectionViewRecord(result.data);
  }

  async function handlePick(viewId: string) {
    await persistActive(viewId);
  }

  async function handleCreate() {
    const source =
      views.find((view) => view.id === activeViewId) ??
      views[0] ??
      createFallbackView(entity.id);
    const draft: CollectionView = {
      ...source,
      id: newViewId(entity.id),
      displayName: uniqueUntitledName(views),
      position: nextPosition(views),
      isDefault: false,
      config: source.config,
    };
    try {
      const saved = await saveView(draft);
      const nextViews = [...views, saved];
      setViews(nextViews);
      await persistActive(saved.id);
    } catch (err) {
      console.warn("[collection-views] create failed", err);
      setViewError("Could not save collection view");
    }
  }

  async function handleRename(viewId: string, displayName: string) {
    const existing = views.find((view) => view.id === viewId);
    const trimmed = displayName.trim();
    if (!existing || !trimmed) return;
    try {
      const saved = await saveView(
        buildRenameView(existing, trimmed, entity),
      );
      setViews((current) =>
        current.map((view) => (view.id === viewId ? saved : view)),
      );
    } catch (err) {
      console.warn("[collection-views] rename failed", err);
      setViewError("Could not save collection view");
      throw err;
    }
  }

  async function handlePatchViewConfig(viewId: string, config: ViewConfig) {
    const existing = views.find((view) => view.id === viewId);
    if (!existing) return;
    try {
      const saved = await saveView(buildConfigPatchView(existing, config));
      setViews((current) =>
        current.map((view) => (view.id === viewId ? saved : view)),
      );
    } catch (err) {
      console.warn("[collection-views] config save failed", err);
      setViewError("Could not save collection view");
      throw err;
    }
  }

  function handleResizePreview(surface: "side-peek" | "bottom-peek", size: number) {
    if (!activeView) return;
    const layout =
      surface === "side-peek"
        ? { ...activeConfig.layout, sidePeekWidth: size }
        : { ...activeConfig.layout, bottomPeekHeight: size };

    void handlePatchViewConfig(
      activeView.id,
      patchViewConfig(activeConfig, { layout }),
    );
  }

  async function handleDuplicate(viewId: string) {
    const source = views.find((view) => view.id === viewId);
    if (!source) return;
    try {
      const saved = await saveView(duplicateViewDraft(source, views));
      setViews([...views, saved]);
      await persistActive(saved.id);
    } catch (err) {
      console.warn("[collection-views] duplicate failed", err);
      setViewError("Could not save collection view");
    }
  }

  async function handleDelete(viewId: string) {
    const deletedIndex = orderedViews(views).findIndex((v) => v.id === viewId);
    try {
      if (isTauri()) {
        const result = await commands.collectionViewDelete(viewId);
        if (result.status === "error") throw new Error(result.error);
      }
      let nextViews = views.filter((view) => view.id !== viewId);
      if (nextViews.length === 0) {
        const fallback = await saveView(createFallbackView(entity.id));
        nextViews = [fallback];
      }
      setViews(nextViews);
      if (activeViewId === viewId || !activeViewId) {
        const orderedNext = orderedViews(nextViews);
        const neighborId =
          orderedNext[deletedIndex - 1]?.id ?? orderedNext[deletedIndex]?.id ?? null;
        if (neighborId) await persistActive(neighborId);
      }
    } catch (err) {
      console.warn("[collection-views] delete failed", err);
      setViewError("Could not delete collection view");
    }
  }

  function handleSelect(item: TItem) {
    setSelectedId(entity.getId(item));
    setFocusTrail((current) => resetFocusTrail(current, item, getFocusLabel, entity.getId));
    setPreviewOpen(true);
  }

  function handleClosePreview() {
    setPreviewOpen(false);
    // selectedId stays — row remains highlighted after preview closes.
  }

  function handleOpenSingleEdge(edge: SingleTargetEdge<TItem>): boolean {
    const target = edge.target;
    if (!target || edge.danglingReason) return false;
    setFocusTrail((current) => {
      const baseTrail = current.length > 0
        ? current
        : selectedItem
          ? initializeFocusTrail(selectedItem, getFocusLabel, entity.getId)
          : [];
      return appendFocusTarget(baseTrail, target, () => edge.targetRef.displayKey, entity.getId);
    });
    setPreviewOpen(true);
    return true;
  }

  function handlePickFocusCrumb(index: number) {
    setFocusTrail((current) => truncateFocusTrail(current, index));
  }

  function handleOpenSetEdge(edge: SetTargetEdge<TItem>): boolean {
    if (edge.danglingReason || !edge.items || edge.items.length === 0) return false;
    // Merge live selectedId/previewOpen into the snapshot so that row navigation
    // performed *after* entering a scoped root is captured before we push scope2.
    const currentRoot =
      rootStack.length > 0
        ? { ...rootStack[rootStack.length - 1], selectedId, previewOpen }
        : createBaseRoot(rootItems, selectedId, previewOpen);
    const nextSelected = edge.items[0] ? entity.getId(edge.items[0]) : null;
    const result = pushScopedRoot({
      activeRoot: currentRoot,
      stack: rootStack.slice(0, -1),
      nextRoot: {
        id: edge.id,
        label: edge.label,
        items: edge.items,
        selectedId: nextSelected,
        previewOpen: edge.items.length > 0,
      },
    });
    setRootStack([...result.stack, result.activeRoot]);
    setSelectedId(nextSelected);
    if (edge.items[0]) {
      setFocusTrail(initializeFocusTrail(edge.items[0], getFocusLabel, entity.getId));
    } else {
      setFocusTrail([]);
    }
    setPreviewOpen(edge.items.length > 0);
    return true;
  }

  function handleReturnFromRoot() {
    if (rootStack.length === 0) return;
    const active = rootStack[rootStack.length - 1];
    const result = returnToPreviousRoot({
      activeRoot: active,
      stack: rootStack.slice(0, -1),
      getId: entity.getId,
    });
    // When we've returned all the way to base, clear the stack entirely so
    // activeRoot is computed from the live `items` prop rather than a snapshot.
    // For non-base returns, preserve the full stack (including any base entry)
    // so further Back presses can unwind all the way.
    if (result.activeRoot.base) {
      setRootStack([]);
    } else {
      setRootStack([...result.stack, result.activeRoot]);
    }
    setSelectedId(result.activeRoot.selectedId);
    setPreviewOpen(result.activeRoot.previewOpen);
    const restored = result.activeRoot.selectedId
      ? result.activeRoot.items.find((item) => entity.getId(item) === result.activeRoot.selectedId)
      : null;
    setFocusTrail(restored ? initializeFocusTrail(restored, getFocusLabel, entity.getId) : []);
  }

  const openItemById = useCallback(
    (
      id: string,
      options: { openPreview?: boolean; scopedFallback?: boolean } = {},
    ): boolean => {
      const target = items.find((item) => entity.getId(item) === id);
      if (!target) return false;
      const targetId = entity.getId(target);
      const visibleInCurrentPipeline = displayItems.some(
        (item) => entity.getId(item) === targetId,
      );
      const wantPreview = options.openPreview !== false;

      if (!visibleInCurrentPipeline && options.scopedFallback !== false) {
        const label = `Opened ${getFocusLabel(target)}`;
        const currentRoot =
          rootStack.length > 0
            ? { ...rootStack[rootStack.length - 1], selectedId, previewOpen }
            : createBaseRoot(rootItems, selectedId, previewOpen);
        const result = pushScopedRoot({
          activeRoot: currentRoot,
          stack: rootStack.slice(0, -1),
          nextRoot: {
            id: `quick-switcher:${targetId}`,
            label,
            items: [target],
            selectedId: targetId,
            previewOpen: wantPreview,
          },
        });
        setRootStack([...result.stack, result.activeRoot]);
      }

      setSelectedId(targetId);
      setFocusTrail((current) =>
        resetFocusTrail(current, target, getFocusLabel, entity.getId),
      );
      setPreviewOpen(wantPreview);
      return true;
    },
    [
      displayItems,
      entity,
      getFocusLabel,
      items,
      previewOpen,
      rootItems,
      rootStack,
      selectedId,
    ],
  );

  // ---- Header ---------------------------------------------------------

  let header: ReactNode;
  if (viewsLoading) {
    header = (
      <span className="inline-flex items-center">
        <Spinner label="Loading collection views" size={14} />
      </span>
    );
  } else if (viewError && views.length === 0) {
    header = <span className="text-sm text-red">{viewError}</span>;
  } else {
    header = (
      <CollectionHeader
        views={views}
        activeViewId={activeViewId}
        onPick={handlePick}
        onCreate={handleCreate}
        onRename={handleRename}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        settingsSlot={
          <ViewSettingsMenu
            activeView={activeView}
            entity={entity}
            onRenameView={handleRename}
            onPatchConfig={handlePatchViewConfig}
            onOpenChange={setSettingsOpen}
            items={rootItems}
            filterOptionContext={{ items: rootItems }}
          />
        }
      />
    );
  }

  // ---- Body -----------------------------------------------------------

  let bodyContent: ReactNode;
  if (loading) {
    bodyContent = (
      <div className="flex items-center justify-center flex-1 p-8">
        <Spinner label={copy.loadingLabel} size={20} />
      </div>
    );
  } else if (error) {
    bodyContent = (
      <EmptyState
        title={copy.errorTitle}
        description={copy.errorDescription ?? "Something went wrong. Check the source configuration and try again."}
        className="flex-1"
      />
    );
  } else if (items.length === 0) {
    bodyContent = (
      <EmptyState
        title={copy.emptyTitle}
        description={copy.emptyDescription}
        className="flex-1"
      />
    );
  } else {
    const preview = activeConfig.layout.preview;
    const showFullPage =
      preview === "full-page" && !!previewFocusItem && previewOpen;

    if (showFullPage) {
      bodyContent = (
        <FullPagePreview
          item={previewFocusItem}
          entity={entity}
          index={selectedIndex}
          total={displayItems.length}
          canMovePrevious={canMovePrevious}
          canMoveNext={canMoveNext}
          onBack={() => setPreviewOpen(false)}
          onMovePrevious={movePrevious}
          onMoveNext={moveNext}
          focusTrail={focusTrail}
          onPickFocusCrumb={handlePickFocusCrumb}
          edges={previewEdges}
          onOpenSingleEdge={handleOpenSingleEdge}
          onOpenSetEdge={handleOpenSetEdge}
        />
      );
    } else {
      const peekSurface =
        preview === "bottom-peek" ? "bottom-peek" : "side-peek";
      bodyContent = (
        <div
          className={`flex min-h-0 flex-1 overflow-hidden ${
            preview === "bottom-peek" ? "flex-col" : ""
          }`}
        >
          <div className="flex-1 overflow-y-auto">
            {!activeRoot.base && (
              <ReRootBanner
                label={activeRoot.label}
                totalCount={activeRoot.items.length}
                matchingCount={sortedItems.length}
                backLabel="Back to All"
                onBack={handleReturnFromRoot}
              />
            )}
            {partialFailures && partialFailures.length > 0 && (
              <div role="status" className="border-b border-yellow/40 bg-yellow/10 px-3 py-2 text-sm text-text">
                {partialFailures.map((failure) => (
                  <p key={`${failure.source}:${failure.message}`}>
                    {failure.message}
                  </p>
                ))}
                {retry && <button type="button" onClick={retry} className="mt-1 text-xs underline">Retry</button>}
              </div>
            )}
            <Body
              items={sortedItems}
              unfilteredCount={rootItems.length}
              scopedEmptyLabel={activeRoot.base ? undefined : "related items"}
              entity={entity}
              properties={activeConfig.propertyVisibility as PropertyConfig<TProperty>[]}
              group={activeConfig.group}
              collapsedGroupKeys={collapsedGroupKeys}
              onToggleGroupCollapsed={toggleGroupCollapsed}
              selectedId={selectedId}
              density={activeConfig.layout.density}
              selection={{
                selectedIds: rowSelection.selectedIds,
                onToggle: (item) => rowSelection.toggle(entity.getId(item)),
                getLabel: (item) => `Select ${entity.getId(item)}`,
              }}
              onSelect={handleSelect}
            />
          </div>
          {previewFocusItem && previewOpen && preview !== "full-page" && (
            <Detail
              item={previewFocusItem}
              entity={entity}
              surface={peekSurface}
              sidePeekWidth={activeConfig.layout.sidePeekWidth}
              bottomPeekHeight={activeConfig.layout.bottomPeekHeight}
              index={selectedIndex}
              total={displayItems.length}
              canMovePrevious={canMovePrevious}
              canMoveNext={canMoveNext}
              onClose={handleClosePreview}
              onMovePrevious={movePrevious}
              onMoveNext={moveNext}
              onResizeCommit={handleResizePreview}
              focusTrail={focusTrail}
              onPickFocusCrumb={handlePickFocusCrumb}
              edges={previewEdges}
              onOpenSingleEdge={handleOpenSingleEdge}
              onOpenSetEdge={handleOpenSetEdge}
            />
          )}
        </div>
      );
    }
  }

  const body = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {viewError && views.length > 0 && (
        <div className="border-b border-border/60 px-3 py-1 text-sm text-red">
          {viewError}
        </div>
      )}
      {bodyContent}
    </div>
  );

  return {
    header,
    body,
    openItemById,
    openSingleEdge: handleOpenSingleEdge,
    openSetEdge: handleOpenSetEdge,
  };
}
