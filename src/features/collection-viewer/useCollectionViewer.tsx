import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { commands } from "../../bindings";
import type { JiraIssueListItem } from "../../bindings";
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
import { jiraIssueEntity } from "../../entities/jira-issue";
import type { JiraIssueProperty } from "../../entities/jira-issue/properties";
import type { PropertyConfig } from "../../views/collection/types";
import { useJiraIssues } from "./data";
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
import { normalizeViewConfig } from "../../views/collection/ViewConfig";
import type { ViewConfig } from "../../views/collection/ViewConfig";
import { buildConfigPatchView, buildRenameView } from "./viewConfigPersistence";
import { ViewSettingsMenu } from "../../views/collection/menu/ViewSettingsMenu";
import { useKeyboardNavigation } from "../../views/collection/useKeyboardNavigation";

const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function newViewId(entityKind: string): string {
  return `${entityKind}-view-${Date.now()}`;
}

export type UseCollectionViewerArgs = {
  /** True when the collection viewer is the focused page. Gates keyboard nav. */
  active: boolean;
};

export type UseCollectionViewerResult = {
  /** Goes into the AppShell's `mainHeader` slot. */
  header: ReactNode;
  /** Goes into the AppShell's `mainContent` slot. */
  body: ReactNode;
};

export function useCollectionViewer({
  active,
}: UseCollectionViewerArgs): UseCollectionViewerResult {
  const { issues, loading, error } = useJiraIssues();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(new Set());
  const [views, setViews] = useState<CollectionView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<AppPreferences>({});
  const [viewsLoading, setViewsLoading] = useState(true);
  const [viewError, setViewError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeView = views.find((view) => view.id === activeViewId) ?? null;

  const activeConfig = useMemo(
    () => normalizeViewConfig(activeView?.config, jiraIssueEntity),
    [activeView?.config],
  );

  const filteredItems = useMemo(
    () => filterCollectionItems({ items: issues, entity: jiraIssueEntity, filters: activeConfig.filters }),
    [issues, activeConfig.filters],
  );

  const sortedItems = useMemo(
    () => sortCollectionItems(filteredItems, jiraIssueEntity, activeConfig.sort),
    [filteredItems, activeConfig.sort],
  );

  const groupedItems = useMemo(
    () =>
      activeConfig.group.property === null
        ? []
        : bucketCollectionItems({
            items: sortedItems,
            entity: jiraIssueEntity,
            group: activeConfig.group,
          }),
    [sortedItems, activeConfig.group],
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
    if (displayItems.some((item) => item.work_item_id === selectedId)) return;
    const first = displayItems[0];
    setSelectedId(first?.work_item_id ?? null);
  }, [displayItems, selectedId]);

  const selectedIndex = useMemo(
    () =>
      selectedId
        ? displayItems.findIndex((item) => item.work_item_id === selectedId)
        : -1,
    [displayItems, selectedId],
  );

  const selectedItem: JiraIssueListItem | null =
    selectedIndex >= 0 ? displayItems[selectedIndex] : null;
  const canMovePrevious = selectedIndex > 0;
  const canMoveNext =
    selectedIndex >= 0 && selectedIndex < displayItems.length - 1;

  const movePrevious = useCallback(() => {
    if (selectedIndex <= 0) return;
    setSelectedId(displayItems[selectedIndex - 1].work_item_id);
  }, [displayItems, selectedIndex]);

  const moveNext = useCallback(() => {
    if (selectedIndex < 0 || selectedIndex >= displayItems.length - 1) return;
    setSelectedId(displayItems[selectedIndex + 1].work_item_id);
  }, [displayItems, selectedIndex]);

  const selectFirst = useCallback(() => {
    if (displayItems.length === 0) return;
    setSelectedId(displayItems[0].work_item_id);
  }, [displayItems]);

  const selectLast = useCallback(() => {
    if (displayItems.length === 0) return;
    setSelectedId(displayItems[displayItems.length - 1].work_item_id);
  }, [displayItems]);

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
  });

  useEffect(() => {
    let cancelled = false;
    async function loadViews() {
      setViewsLoading(true);
      setViewError(null);
      try {
        const [seededViews, prefs] = await Promise.all([
          seedCollectionViews(jiraIssueEntity.id, jiraIssueEntity.defaultViews),
          loadPreferences(),
        ]);
        if (cancelled) return;
        const safeViews =
          seededViews.length > 0
            ? seededViews
            : [createFallbackView(jiraIssueEntity.id)];
        const savedId =
          prefs.collections?.activeViewId?.[jiraIssueEntity.id] ?? null;
        const activeId = pickActiveViewId(safeViews, savedId);
        setPreferences(prefs);
        setViews(safeViews);
        setActiveViewId(activeId);
        setViewsLoading(false);
        if (activeId && activeId !== savedId) {
          const result = await savePreferences(
            prefs,
            activeViewPreferencePatch(jiraIssueEntity.id, activeId),
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
  }, []);

  async function persistActive(viewId: string) {
    setActiveViewId(viewId);
    const result = await savePreferences(
      preferences,
      activeViewPreferencePatch(jiraIssueEntity.id, viewId),
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
      createFallbackView(jiraIssueEntity.id);
    const draft: CollectionView = {
      ...source,
      id: newViewId(jiraIssueEntity.id),
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
        buildRenameView(existing, trimmed, jiraIssueEntity),
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
        const fallback = await saveView(createFallbackView(jiraIssueEntity.id));
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

  function handleSelect(item: JiraIssueListItem) {
    setSelectedId(item.work_item_id);
    setPreviewOpen(true);
  }

  function handleClosePreview() {
    setPreviewOpen(false);
    // selectedId stays — row remains highlighted after preview closes.
  }

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
            entity={jiraIssueEntity}
            onRenameView={handleRename}
            onPatchConfig={handlePatchViewConfig}
            onOpenChange={setSettingsOpen}
            items={issues}
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
        <Spinner label="Loading Jira issues" size={20} />
      </div>
    );
  } else if (error) {
    bodyContent = (
      <EmptyState
        title="Could not load Jira issues"
        description="Something went wrong. Check the console for details."
        className="flex-1"
      />
    );
  } else if (issues.length === 0) {
    bodyContent = (
      <EmptyState
        title="No Jira issues yet"
        description="Run Jira ingestion from Settings → Sources to populate this list."
        className="flex-1"
      />
    );
  } else {
    const preview = activeConfig.layout.preview;
    const showFullPage =
      preview === "full-page" && !!selectedItem && previewOpen;

    if (showFullPage) {
      bodyContent = (
        <FullPagePreview
          item={selectedItem}
          entity={jiraIssueEntity}
          index={selectedIndex}
          total={displayItems.length}
          canMovePrevious={canMovePrevious}
          canMoveNext={canMoveNext}
          onBack={() => setPreviewOpen(false)}
          onMovePrevious={movePrevious}
          onMoveNext={moveNext}
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
            <Body
              items={sortedItems}
              unfilteredCount={issues.length}
              entity={jiraIssueEntity}
              properties={activeConfig.propertyVisibility as PropertyConfig<JiraIssueProperty>[]}
              group={activeConfig.group}
              collapsedGroupKeys={collapsedGroupKeys}
              onToggleGroupCollapsed={toggleGroupCollapsed}
              selectedId={selectedId}
              density={activeConfig.layout.density}
              onSelect={handleSelect}
            />
          </div>
          {selectedItem && previewOpen && preview !== "full-page" && (
            <Detail
              item={selectedItem}
              entity={jiraIssueEntity}
              surface={peekSurface}
              index={selectedIndex}
              total={displayItems.length}
              canMovePrevious={canMovePrevious}
              canMoveNext={canMoveNext}
              onClose={handleClosePreview}
              onMovePrevious={movePrevious}
              onMoveNext={moveNext}
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

  return { header, body };
}
