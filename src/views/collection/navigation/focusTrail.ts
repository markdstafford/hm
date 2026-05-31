import type { FocusTrailEntry } from "./types";

export type FocusTrailLabelResolver<TItem> = (item: TItem) => string | null | undefined;
export type FocusTrailIdResolver<TItem> = (item: TItem) => string;

function resolveLabel<TItem>(
  item: TItem,
  getLabel: FocusTrailLabelResolver<TItem>,
  getId?: FocusTrailIdResolver<TItem>,
): string {
  const label = getLabel(item)?.trim();
  if (label) return label;
  return getId ? getId(item) : "Unknown item";
}

export function initializeFocusTrail<TItem>(
  item: TItem,
  getLabel: FocusTrailLabelResolver<TItem>,
  getId?: FocusTrailIdResolver<TItem>,
): FocusTrailEntry<TItem>[] {
  return [{ item, label: resolveLabel(item, getLabel, getId) }];
}

export function appendFocusTarget<TItem>(
  trail: FocusTrailEntry<TItem>[],
  item: TItem,
  getLabel: FocusTrailLabelResolver<TItem>,
  getId?: FocusTrailIdResolver<TItem>,
): FocusTrailEntry<TItem>[] {
  return [...trail, { item, label: resolveLabel(item, getLabel, getId) }];
}

export function truncateFocusTrail<TItem>(
  trail: FocusTrailEntry<TItem>[],
  index: number,
): FocusTrailEntry<TItem>[] {
  if (index < 0 || index >= trail.length) return trail;
  return trail.slice(0, index + 1);
}

export function resetFocusTrail<TItem>(
  _trail: FocusTrailEntry<TItem>[],
  item: TItem,
  getLabel: FocusTrailLabelResolver<TItem>,
  getId?: FocusTrailIdResolver<TItem>,
): FocusTrailEntry<TItem>[] {
  return initializeFocusTrail(item, getLabel, getId);
}

export function currentFocusItem<TItem>(trail: FocusTrailEntry<TItem>[]): TItem | null {
  return trail.length === 0 ? null : trail[trail.length - 1].item;
}
