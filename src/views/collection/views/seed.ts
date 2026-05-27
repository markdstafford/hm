import { commands } from "../../../bindings";
import type { AppPreferences } from "../../../preferences";
import type { CollectionView } from "./types";
import { fromCollectionViewRecord, toCollectionViewSaveInput } from "./types";

const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function orderedViews(views: CollectionView[]): CollectionView[] {
  return [...views].sort((a, b) => a.position - b.position || a.displayName.localeCompare(b.displayName));
}

export function pickActiveViewId(views: CollectionView[], savedId?: string | null): string | null {
  const ordered = orderedViews(views);
  if (savedId && ordered.some((view) => view.id === savedId)) return savedId;
  return ordered[0]?.id ?? null;
}

export function nextPosition(views: CollectionView[]): number {
  if (views.length === 0) return 0;
  return Math.max(...views.map((view) => view.position)) + 1;
}

export function uniqueUntitledName(views: CollectionView[], base = "Untitled view"): string {
  const existing = new Set(views.map((view) => view.displayName));
  if (!existing.has(base)) return base;
  let index = 2;
  while (existing.has(`${base} ${index}`)) index += 1;
  return `${base} ${index}`;
}

export function duplicateViewDraft(source: CollectionView, views: CollectionView[]): CollectionView {
  return {
    ...source,
    id: `${source.id}-copy-${Date.now()}`,
    displayName: uniqueUntitledName(views, `${source.displayName} (copy)`),
    position: nextPosition(views),
    isDefault: false,
    config: source.config,
  };
}

export function createFallbackView(entityKind: string): CollectionView {
  return {
    id: `${entityKind}-fallback-view`,
    entityKind,
    displayName: "All open",
    position: 0,
    isDefault: true,
    config: {},
  };
}

export function activeViewPreferencePatch(
  entityKind: string,
  viewId: string,
): Partial<AppPreferences> {
  return {
    collections: {
      activeViewId: {
        [entityKind]: viewId,
      },
    },
  };
}

export async function seedCollectionViews(
  entityKind: string,
  defaults: CollectionView[],
): Promise<CollectionView[]> {
  if (!isTauri()) return orderedViews(defaults);
  const result = await commands.collectionViewsSeedDefaults({
    entity_kind: entityKind,
    defaults: defaults.map(toCollectionViewSaveInput),
  });
  if (result.status === "error") throw new Error(result.error);
  return orderedViews(result.data.map(fromCollectionViewRecord));
}
