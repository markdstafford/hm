import type { EntityContract, FilterableProperty } from "../types";
import type { FilterConfig } from "../ViewConfig";
import { defaultOperatorForKind, operatorFor, operatorRequiresValue } from "./operators";
import type { FilterKind, FilterValueControl } from "./types";

// -----------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function defaultValueForControl(valueControl: FilterValueControl): unknown {
  switch (valueControl) {
    case "text":
    case "number":
      return "";
    case "single-select":
    case "person":
    case "date":
    case "relative-date":
    case "none":
      return null;
    case "multi-select":
      return [];
  }
}

function defaultValueForKind(kind: FilterKind): unknown {
  const defaultOp = defaultOperatorForKind(kind);
  return defaultValueForControl(defaultOp.valueControl);
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "filter-" + Math.random().toString(36).slice(2);
}

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

export function availableFilterProperties<TItem, TProperty extends string>(
  entity: EntityContract<TItem, TProperty>,
): FilterableProperty<TItem, TProperty>[] {
  return (entity.filterableProperties ?? []).map((fp) => ({ ...fp }));
}

export function filterablePropertyFor<TItem, TProperty extends string>(
  entity: EntityContract<TItem, TProperty>,
  propertyId: string,
): FilterableProperty<TItem, TProperty> | null {
  const found = (entity.filterableProperties ?? []).find(
    (fp) => (fp.property as string) === propertyId,
  );
  return found ? { ...found } : null;
}

export function defaultFilterForEntity<TItem, TProperty extends string>(
  entity: EntityContract<TItem, TProperty>,
): FilterConfig | null {
  return addFilter([], entity)[0] ?? null;
}

export function normalizeFilterRows<TItem, TProperty extends string>(
  input: unknown,
  entity: EntityContract<TItem, TProperty>,
): FilterConfig[] {
  if (!Array.isArray(input)) return [];

  const filterableIds = new Set(
    (entity.filterableProperties ?? []).map((fp) => fp.property as string),
  );

  const rows: FilterConfig[] = [];

  for (const rawRow of input) {
    if (!isObject(rawRow)) continue;

    const id = rawRow["id"];
    const property = rawRow["property"];
    const operator = rawRow["operator"];

    if (typeof id !== "string") continue;
    if (typeof property !== "string") continue;
    if (typeof operator !== "string") continue;

    // Drop rows with stale property ids
    if (!filterableIds.has(property)) continue;

    // Find filterable property and validate operator
    const filterableProp = (entity.filterableProperties ?? []).find(
      (fp) => (fp.property as string) === property,
    );
    if (!filterableProp) continue;

    const op = operatorFor(filterableProp.kind, operator);
    if (!op) continue;

    // active defaults to true if missing or not boolean
    const rawActive = rawRow["active"];
    const active = typeof rawActive === "boolean" ? rawActive : true;

    // Normalize value or use default
    const rawValue = "value" in rawRow ? rawRow["value"] : undefined;
    let value: unknown;
    if (rawValue !== undefined) {
      value = normalizeValueForControl(rawValue, op.valueControl);
    } else {
      value = defaultValueForControl(op.valueControl);
    }

    rows.push({ id, property, operator, value, active });
  }

  return rows;
}

function normalizeValueForControl(value: unknown, valueControl: FilterValueControl): unknown {
  switch (valueControl) {
    case "text":
    case "number":
      return typeof value === "string" ? value : "";
    case "single-select":
    case "person":
    case "date":
    case "relative-date":
      return value != null ? value : null;
    case "multi-select":
      return Array.isArray(value) ? value : [];
    case "none":
      return null;
  }
}

export function addFilter<TItem, TProperty extends string>(
  rows: FilterConfig[],
  entity: EntityContract<TItem, TProperty>,
): FilterConfig[] {
  const filterableProps = entity.filterableProperties ?? [];
  if (filterableProps.length === 0) return rows.map((r) => ({ ...r }));

  const firstProp = filterableProps[0];
  const defaultOp = defaultOperatorForKind(firstProp.kind);
  const id = generateId();

  return [
    ...rows.map((r) => ({ ...r })),
    {
      id,
      property: firstProp.property as string,
      operator: defaultOp.id,
      value: defaultValueForControl(defaultOp.valueControl),
      active: true,
    },
  ];
}

export function updateFilterProperty<TItem, TProperty extends string>(
  rows: FilterConfig[],
  rowId: string,
  propertyId: string,
  entity: EntityContract<TItem, TProperty>,
): FilterConfig[] {
  const rowIndex = rows.findIndex((r) => r.id === rowId);
  if (rowIndex < 0) return rows.map((r) => ({ ...r }));

  const newFilterableProp = filterablePropertyFor(entity, propertyId);
  if (!newFilterableProp) return rows.map((r) => ({ ...r }));

  const defaultOp = defaultOperatorForKind(newFilterableProp.kind);

  return rows.map((r, i) =>
    i === rowIndex
      ? {
          ...r,
          property: propertyId,
          operator: defaultOp.id,
          value: defaultValueForControl(defaultOp.valueControl),
        }
      : { ...r },
  );
}

export function updateFilterOperator<TItem, TProperty extends string>(
  rows: FilterConfig[],
  rowId: string,
  operatorId: string,
  entity: EntityContract<TItem, TProperty>,
): FilterConfig[] {
  const rowIndex = rows.findIndex((r) => r.id === rowId);
  if (rowIndex < 0) return rows.map((r) => ({ ...r }));

  const row = rows[rowIndex];
  const filterableProp = filterablePropertyFor(entity, row.property);
  if (!filterableProp) return rows.map((r) => ({ ...r }));

  const op = operatorFor(filterableProp.kind, operatorId);
  if (!op) return rows.map((r) => ({ ...r }));

  return rows.map((r, i) =>
    i === rowIndex
      ? { ...r, operator: operatorId, value: defaultValueForControl(op.valueControl) }
      : { ...r },
  );
}

export function updateFilterValue(
  rows: FilterConfig[],
  rowId: string,
  value: unknown,
): FilterConfig[] {
  const rowIndex = rows.findIndex((r) => r.id === rowId);
  if (rowIndex < 0) return rows.map((r) => ({ ...r }));

  return rows.map((r, i) => (i === rowIndex ? { ...r, value } : { ...r }));
}

export function removeFilter(rows: FilterConfig[], rowId: string): FilterConfig[] {
  return rows.filter((r) => r.id !== rowId).map((r) => ({ ...r }));
}

export function clearFilters(): FilterConfig[] {
  return [];
}

export function isFilterComplete<TItem, TProperty extends string>(
  row: FilterConfig,
  entity: EntityContract<TItem, TProperty>,
): boolean {
  const filterableProp = filterablePropertyFor(entity, row.property);
  if (!filterableProp) return false;

  const op = operatorFor(filterableProp.kind, row.operator);
  if (!op) return false;

  if (!operatorRequiresValue(op)) return true;

  const { valueControl } = op;
  const { value } = row;

  switch (valueControl) {
    case "text":
    case "number":
      return typeof value === "string" && value.trim() !== "";
    case "single-select":
    case "person":
    case "date":
    case "relative-date":
      return value != null;
    case "multi-select":
      return Array.isArray(value) && value.length > 0;
    case "none":
      return true;
  }
}

export function summarizeFilters<TItem, TProperty extends string>(
  rows: FilterConfig[],
  entity: EntityContract<TItem, TProperty>,
): string {
  const count = rows.filter((r) => r.active && isFilterComplete(r, entity)).length;
  if (count === 0) return "None";
  if (count === 1) return "1 active";
  return `${count} active`;
}

// Re-export defaultValueForKind for potential use by callers
export { defaultValueForKind };
