import type { BucketDefinition, FilterableProperty } from "../../views/collection/types";
import type { FilterOption, FilterOptionContext } from "../../views/collection/filter/types";
import type {
  HygieneAction,
  HygieneCategory,
  HygieneSuggestion,
  HygieneSuggestionProperty,
} from "./types";

export const ACTION_LABELS: Record<HygieneAction, string> = {
  "close-as-resolved": "Close as resolved",
  "merge-as-duplicate": "Merge as duplicate",
  reassign: "Reassign",
  "ping-for-context": "Ping for context",
  "enrich-title-and-body": "Enrich title + body",
};

export const CATEGORY_LABELS: Record<HygieneCategory, string> = {
  duplicate: "Duplicate",
  stale: "Stale",
  enrichment: "Enrichment",
};

export const ACTION_BUCKET_ORDER: BucketDefinition[] = [
  { key: "close-as-resolved", label: ACTION_LABELS["close-as-resolved"] },
  { key: "merge-as-duplicate", label: ACTION_LABELS["merge-as-duplicate"] },
  { key: "reassign", label: ACTION_LABELS.reassign },
  { key: "ping-for-context", label: ACTION_LABELS["ping-for-context"] },
  { key: "enrich-title-and-body", label: ACTION_LABELS["enrich-title-and-body"] },
];

export const CATEGORY_BUCKET_ORDER: BucketDefinition[] = [
  { key: "duplicate", label: CATEGORY_LABELS.duplicate },
  { key: "stale", label: CATEGORY_LABELS.stale },
  { key: "enrichment", label: CATEGORY_LABELS.enrichment },
];

export const CONFIDENCE_BUCKET_ORDER: BucketDefinition[] = [
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

export function actionLabel(action: HygieneAction): string {
  return ACTION_LABELS[action];
}

export function categoryLabel(category: HygieneCategory): string {
  return CATEGORY_LABELS[category];
}

export function confidenceBucketFor(score: number): BucketDefinition {
  if (score >= 85) return CONFIDENCE_BUCKET_ORDER[0];
  if (score >= 60) return CONFIDENCE_BUCKET_ORDER[1];
  return CONFIDENCE_BUCKET_ORDER[2];
}

export function clampConfidence(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function derivedKey(item: HygieneSuggestion): string {
  return item.category === "duplicate" && item.duplicateOf?.key
    ? `${item.target.key} → ${item.duplicateOf.key}`
    : item.target.key;
}

export function derivedTitle(item: HygieneSuggestion): string {
  return item.target.title;
}

export function derivedStatus(item: HygieneSuggestion): string {
  return item.target.status?.trim() || "No status";
}

export function derivedAssignee(item: HygieneSuggestion): string {
  return item.target.assignee?.trim() || "Unassigned";
}

function normalize(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function compareStringsNullLast(a: string | null | undefined, b: string | null | undefined): number {
  const left = normalize(a);
  const right = normalize(b);
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function indexIn(order: BucketDefinition[], key: string): number {
  const index = order.findIndex((bucket) => bucket.key === key);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function compareHygieneByAction(a: HygieneSuggestion, b: HygieneSuggestion): number {
  return indexIn(ACTION_BUCKET_ORDER, a.action) - indexIn(ACTION_BUCKET_ORDER, b.action);
}

export function compareHygieneByCategory(a: HygieneSuggestion, b: HygieneSuggestion): number {
  return indexIn(CATEGORY_BUCKET_ORDER, a.category) - indexIn(CATEGORY_BUCKET_ORDER, b.category);
}

export function compareHygieneByConfidence(a: HygieneSuggestion, b: HygieneSuggestion): number {
  return a.confidence - b.confidence;
}

export function rawStatus(item: HygieneSuggestion): string | null {
  return item.target.status?.trim() || null;
}

export function rawAssignee(item: HygieneSuggestion): string | null {
  return item.target.assignee?.trim() || null;
}

export function compareHygieneByStatus(a: HygieneSuggestion, b: HygieneSuggestion): number {
  return compareStringsNullLast(rawStatus(a), rawStatus(b));
}

export function compareHygieneByAssignee(a: HygieneSuggestion, b: HygieneSuggestion): number {
  return compareStringsNullLast(rawAssignee(a), rawAssignee(b));
}

export function compareHygieneByKey(a: HygieneSuggestion, b: HygieneSuggestion): number {
  return compareStringsNullLast(a.target.key, b.target.key);
}

export function compareHygieneByTitle(a: HygieneSuggestion, b: HygieneSuggestion): number {
  return compareStringsNullLast(a.target.title, b.target.title);
}

function optionsFromItems(
  items: HygieneSuggestion[],
  getValue: (item: HygieneSuggestion) => string | null,
): FilterOption[] {
  const seen = new Set<string>();
  for (const item of items) {
    const value = getValue(item);
    if (value !== null && value !== "") seen.add(value);
  }
  return [...seen]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ id: value, label: value }));
}

function actionOptions(): FilterOption[] {
  return ACTION_BUCKET_ORDER.map(({ key, label }) => ({ id: key, label }));
}

function categoryOptions(): FilterOption[] {
  return CATEGORY_BUCKET_ORDER.map(({ key, label }) => ({ id: key, label }));
}

function statusOptions(context: FilterOptionContext<HygieneSuggestion>): FilterOption[] {
  return optionsFromItems(context.items as HygieneSuggestion[], rawStatus);
}

function assigneeOptions(context: FilterOptionContext<HygieneSuggestion>): FilterOption[] {
  return optionsFromItems(context.items as HygieneSuggestion[], rawAssignee);
}

export const hygieneFilterableProperties: FilterableProperty<
  HygieneSuggestion,
  HygieneSuggestionProperty
>[] = [
  { property: "action", kind: "select", getValue: (item) => item.action, options: actionOptions },
  { property: "key", kind: "text", getValue: derivedKey },
  { property: "title", kind: "text", getValue: derivedTitle },
  { property: "confidence", kind: "number", getValue: (item) => item.confidence },
  { property: "category", kind: "select", getValue: (item) => item.category, options: categoryOptions },
  { property: "status", kind: "select", getValue: rawStatus, options: statusOptions },
  { property: "assignee", kind: "person", getValue: rawAssignee, options: assigneeOptions },
  { property: "rationale", kind: "text", getValue: (item) => item.rationale },
];
