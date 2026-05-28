import type { FilterKind, FilterOperator } from "./types";

const OPERATOR_SETS: Record<FilterKind, FilterOperator[]> = {
  text: [
    { id: "contains", label: "contains", valueControl: "text", requiresValue: true },
    { id: "does-not-contain", label: "does not contain", valueControl: "text", requiresValue: true },
    { id: "is", label: "is", valueControl: "text", requiresValue: true },
    { id: "is-not", label: "is not", valueControl: "text", requiresValue: true },
    { id: "starts-with", label: "starts with", valueControl: "text", requiresValue: true },
    { id: "ends-with", label: "ends with", valueControl: "text", requiresValue: true },
    { id: "empty", label: "is empty", valueControl: "none", requiresValue: false },
    { id: "not-empty", label: "is not empty", valueControl: "none", requiresValue: false },
  ],
  number: [
    { id: "eq", label: "=", valueControl: "number", requiresValue: true },
    { id: "neq", label: "≠", valueControl: "number", requiresValue: true },
    { id: "gt", label: ">", valueControl: "number", requiresValue: true },
    { id: "lt", label: "<", valueControl: "number", requiresValue: true },
    { id: "gte", label: "≥", valueControl: "number", requiresValue: true },
    { id: "lte", label: "≤", valueControl: "number", requiresValue: true },
    { id: "empty", label: "is empty", valueControl: "none", requiresValue: false },
    { id: "not-empty", label: "is not empty", valueControl: "none", requiresValue: false },
  ],
  select: [
    { id: "contains", label: "contains", valueControl: "multi-select", requiresValue: true },
    { id: "does-not-contain", label: "does not contain", valueControl: "multi-select", requiresValue: true },
    { id: "is", label: "is", valueControl: "single-select", requiresValue: true },
    { id: "is-not", label: "is not", valueControl: "single-select", requiresValue: true },
    { id: "empty", label: "is empty", valueControl: "none", requiresValue: false },
    { id: "not-empty", label: "is not empty", valueControl: "none", requiresValue: false },
  ],
  "multi-select": [
    { id: "contains", label: "contains", valueControl: "multi-select", requiresValue: true },
    { id: "does-not-contain", label: "does not contain", valueControl: "multi-select", requiresValue: true },
    { id: "empty", label: "is empty", valueControl: "none", requiresValue: false },
    { id: "not-empty", label: "is not empty", valueControl: "none", requiresValue: false },
  ],
  date: [
    { id: "is", label: "is", valueControl: "date", requiresValue: true },
    { id: "before", label: "is before", valueControl: "date", requiresValue: true },
    { id: "after", label: "is after", valueControl: "date", requiresValue: true },
    { id: "on-or-before", label: "is on or before", valueControl: "date", requiresValue: true },
    { id: "on-or-after", label: "is on or after", valueControl: "date", requiresValue: true },
    { id: "within", label: "is within", valueControl: "relative-date", requiresValue: true },
    { id: "empty", label: "is empty", valueControl: "none", requiresValue: false },
    { id: "not-empty", label: "is not empty", valueControl: "none", requiresValue: false },
  ],
  person: [
    { id: "contains", label: "contains", valueControl: "person", requiresValue: true },
    { id: "does-not-contain", label: "does not contain", valueControl: "person", requiresValue: true },
    { id: "empty", label: "is empty", valueControl: "none", requiresValue: false },
    { id: "not-empty", label: "is not empty", valueControl: "none", requiresValue: false },
  ],
  checkbox: [
    { id: "is", label: "is checked", valueControl: "none", requiresValue: false },
    { id: "is-not", label: "is not checked", valueControl: "none", requiresValue: false },
  ],
};

export function operatorsForKind(kind: FilterKind): FilterOperator[] {
  return OPERATOR_SETS[kind].map((operator) => ({ ...operator }));
}

export function defaultOperatorForKind(kind: FilterKind): FilterOperator {
  return { ...OPERATOR_SETS[kind][0] };
}

export function operatorFor(kind: FilterKind, operatorId: string): FilterOperator | null {
  const operator = OPERATOR_SETS[kind].find((candidate) => candidate.id === operatorId);
  return operator ? { ...operator } : null;
}

export function operatorRequiresValue(operator: FilterOperator): boolean {
  return operator.requiresValue;
}
