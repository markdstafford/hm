import type { FilterConfig } from "../ViewConfig";
import type { EntityContract } from "../types";
import type { FilterEvaluationContext, RelativeDateValue } from "./types";
import { filterablePropertyFor, isFilterComplete } from "./config";
import { operatorFor } from "./operators";
import { compareLocalDates, dateInRelativeWindow, parseLocalDate } from "./date";

// -------------------------------------------------------------------------
// Internal helpers
// -------------------------------------------------------------------------

function normalize(s: unknown): string {
  return String(s ?? "").trim().toLowerCase();
}

// -------------------------------------------------------------------------
// Predicate evaluation by kind
// -------------------------------------------------------------------------

function evaluateText(operatorId: string, itemValue: unknown, filterValue: unknown): boolean {
  const iv = normalize(itemValue);
  const fv = normalize(filterValue);

  switch (operatorId) {
    case "contains":
      return iv.includes(fv);
    case "does-not-contain":
      return !iv.includes(fv);
    case "is":
      return iv === fv;
    case "is-not":
      return iv !== fv;
    case "starts-with":
      return iv.startsWith(fv);
    case "ends-with":
      return iv.endsWith(fv);
    case "empty":
      return iv === "";
    case "not-empty":
      return iv !== "";
    default:
      return true;
  }
}

function evaluateNumber(operatorId: string, itemValue: unknown, filterValue: unknown): boolean {
  // empty / not-empty handle null/undefined specially
  if (operatorId === "empty") {
    return itemValue == null || String(itemValue).trim() === "";
  }
  if (operatorId === "not-empty") {
    return !(itemValue == null || String(itemValue).trim() === "");
  }

  const itemNum = typeof itemValue === "number" ? itemValue : Number(String(itemValue ?? ""));
  const filterNum = Number(String(filterValue ?? ""));

  if (isNaN(itemNum) || isNaN(filterNum)) return true;

  switch (operatorId) {
    case "eq":
      return itemNum === filterNum;
    case "neq":
      return itemNum !== filterNum;
    case "gt":
      return itemNum > filterNum;
    case "lt":
      return itemNum < filterNum;
    case "gte":
      return itemNum >= filterNum;
    case "lte":
      return itemNum <= filterNum;
    default:
      return true;
  }
}

function evaluateSelect(operatorId: string, itemValue: unknown, filterValue: unknown): boolean {
  const iv = normalize(itemValue);

  switch (operatorId) {
    case "is":
      return iv === normalize(filterValue as string);
    case "is-not":
      return iv !== normalize(filterValue as string);
    case "contains":
      return (filterValue as string[]).some((v) => normalize(v) === iv);
    case "does-not-contain":
      return !(filterValue as string[]).some((v) => normalize(v) === iv);
    case "empty":
      return iv === "";
    case "not-empty":
      return iv !== "";
    default:
      return true;
  }
}

function evaluateMultiSelect(operatorId: string, itemValue: unknown, filterValue: unknown): boolean {
  switch (operatorId) {
    case "contains": {
      const filterVals = filterValue as string[];
      const itemVals = Array.isArray(itemValue) ? (itemValue as unknown[]) : [];
      return filterVals.some((fv) => itemVals.some((iv) => normalize(iv) === normalize(fv)));
    }
    case "does-not-contain": {
      const filterVals = filterValue as string[];
      const itemVals = Array.isArray(itemValue) ? (itemValue as unknown[]) : [];
      return !filterVals.some((fv) => itemVals.some((iv) => normalize(iv) === normalize(fv)));
    }
    case "empty":
      return !Array.isArray(itemValue) || itemValue.length === 0;
    case "not-empty":
      return Array.isArray(itemValue) && itemValue.length > 0;
    default:
      return true;
  }
}

function evaluateDate(
  operatorId: string,
  itemValue: unknown,
  filterValue: unknown,
  context?: FilterEvaluationContext,
): boolean {
  switch (operatorId) {
    case "is": {
      const cmp = compareLocalDates(itemValue, filterValue);
      if (cmp === null) return true;
      return cmp === 0;
    }
    case "before": {
      const cmp = compareLocalDates(itemValue, filterValue);
      if (cmp === null) return true;
      return cmp < 0;
    }
    case "after": {
      const cmp = compareLocalDates(itemValue, filterValue);
      if (cmp === null) return true;
      return cmp > 0;
    }
    case "on-or-before": {
      const cmp = compareLocalDates(itemValue, filterValue);
      if (cmp === null) return true;
      return cmp <= 0;
    }
    case "on-or-after": {
      const cmp = compareLocalDates(itemValue, filterValue);
      if (cmp === null) return true;
      return cmp >= 0;
    }
    case "within":
      return dateInRelativeWindow(itemValue, filterValue as RelativeDateValue, context?.now);
    case "empty":
      return parseLocalDate(itemValue) === null;
    case "not-empty":
      return parseLocalDate(itemValue) !== null;
    default:
      return true;
  }
}

function evaluatePerson(operatorId: string, itemValue: unknown, filterValue: unknown): boolean {
  const iv = normalize(itemValue);

  switch (operatorId) {
    case "contains":
      if (Array.isArray(filterValue)) {
        return (filterValue as unknown[]).some((fv) => iv.includes(normalize(fv)));
      }
      return iv.includes(normalize(filterValue as string));
    case "does-not-contain":
      if (Array.isArray(filterValue)) {
        return !(filterValue as unknown[]).some((fv) => iv.includes(normalize(fv)));
      }
      return !iv.includes(normalize(filterValue as string));
    case "empty":
      return iv === "";
    case "not-empty":
      return iv !== "";
    default:
      return true;
  }
}

function evaluateCheckbox(operatorId: string, itemValue: unknown): boolean {
  switch (operatorId) {
    case "is":
      return Boolean(itemValue) === true;
    case "is-not":
      return Boolean(itemValue) === false;
    default:
      return true;
  }
}

// -------------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------------

export function filterMatchesItem<TItem, TProperty extends string>(args: {
  row: FilterConfig;
  item: TItem;
  entity: EntityContract<TItem, TProperty>;
  allItems?: TItem[];
  context?: FilterEvaluationContext;
}): boolean {
  const { row, item, entity, context } = args;

  // Inactive filters are not applied
  if (!row.active) return true;

  // Find the filterable property
  const filterableProp = filterablePropertyFor(entity, row.property);
  if (!filterableProp) return true;

  // Find the operator
  const op = operatorFor(filterableProp.kind, row.operator);
  if (!op) return true;

  // Check if filter is complete
  if (!isFilterComplete(row, entity)) return true;

  // Get the item value
  const itemValue = filterableProp.getValue(item);
  const filterValue = row.value;

  // Evaluate based on kind
  switch (filterableProp.kind) {
    case "text":
      return evaluateText(op.id, itemValue, filterValue);
    case "number":
      return evaluateNumber(op.id, itemValue, filterValue);
    case "select":
      return evaluateSelect(op.id, itemValue, filterValue);
    case "multi-select":
      return evaluateMultiSelect(op.id, itemValue, filterValue);
    case "date":
      return evaluateDate(op.id, itemValue, filterValue, context);
    case "person":
      return evaluatePerson(op.id, itemValue, filterValue);
    case "checkbox":
      return evaluateCheckbox(op.id, itemValue);
    default:
      return true;
  }
}

export function filterCollectionItems<TItem, TProperty extends string>(args: {
  items: TItem[];
  entity: EntityContract<TItem, TProperty>;
  filters: FilterConfig[];
  context?: FilterEvaluationContext;
}): TItem[] {
  const { items, entity, filters, context } = args;

  if (filters.length === 0) return items;

  return items.filter((item) =>
    filters.every((row) =>
      filterMatchesItem({ row, item, entity, context }),
    ),
  );
}
