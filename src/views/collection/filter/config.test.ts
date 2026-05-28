import { describe, it, expect } from "vitest";
import type { EntityContract } from "../types";
import type { FilterConfig } from "../ViewConfig";
import {
  normalizeFilterRows,
  addFilter,
  updateFilterProperty,
  updateFilterOperator,
  updateFilterValue,
  removeFilter,
  clearFilters,
  isFilterComplete,
  summarizeFilters,
} from "./config";

// -----------------------------------------------------------------------
// Minimal test entity with title (text), status (select), updated (date)
// -----------------------------------------------------------------------
type TestItem = { title: string; status: string; updated: string | null };
type TestProperty = "title" | "status" | "updated";

const testEntity: EntityContract<TestItem, TestProperty> = {
  id: "test-entity",
  label: "Test Entity",
  getId: (item) => item.title,
  properties: [
    { id: "title", label: "Title", kind: "text", renderCell: () => null },
    { id: "status", label: "Status", kind: "categorical", renderCell: () => null },
    { id: "updated", label: "Updated", kind: "date", renderCell: () => null },
  ],
  defaultProperties: [
    { property: "title", side: "left", visible: true },
    { property: "status", side: "right", visible: true },
    { property: "updated", side: "right", visible: true },
  ],
  defaultSort: () => 0,
  filterableProperties: [
    {
      property: "title",
      kind: "text",
      getValue: (item) => item.title,
    },
    {
      property: "status",
      kind: "select",
      getValue: (item) => item.status,
    },
    {
      property: "updated",
      kind: "date",
      getValue: (item) => item.updated,
    },
  ],
  Detail: () => null,
  defaultViews: [],
};

const entityNoFilterable: EntityContract<TestItem, TestProperty> = {
  ...testEntity,
  filterableProperties: undefined,
};

// -----------------------------------------------------------------------
// normalizeFilterRows
// -----------------------------------------------------------------------

describe("normalizeFilterRows", () => {
  it("returns [] for non-array input", () => {
    expect(normalizeFilterRows(null, testEntity)).toEqual([]);
    expect(normalizeFilterRows("bad", testEntity)).toEqual([]);
    expect(normalizeFilterRows(42, testEntity)).toEqual([]);
    expect(normalizeFilterRows({}, testEntity)).toEqual([]);
  });

  it("drops rows with stale property ids", () => {
    const input = [
      { id: "f1", property: "title", operator: "contains", value: "hello", active: true },
      { id: "f2", property: "nonexistent", operator: "contains", value: "x", active: true },
    ];
    const result = normalizeFilterRows(input, testEntity);
    expect(result).toHaveLength(1);
    expect(result[0].property).toBe("title");
  });

  it("drops rows with operators invalid for the property kind", () => {
    // "eq" is a number operator, not valid for text kind
    const input = [
      { id: "f1", property: "title", operator: "eq", value: "", active: true },
      { id: "f2", property: "title", operator: "contains", value: "hello", active: true },
    ];
    const result = normalizeFilterRows(input, testEntity);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("f2");
  });

  it("preserves valid rows in order", () => {
    const input = [
      { id: "f1", property: "status", operator: "is", value: "Done", active: true },
      { id: "f2", property: "title", operator: "contains", value: "hello", active: false },
    ];
    const result = normalizeFilterRows(input, testEntity);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("f1");
    expect(result[1].id).toBe("f2");
  });

  it("defaults active to true for otherwise valid rows without active field", () => {
    const input = [
      { id: "f1", property: "title", operator: "contains", value: "hello" },
    ];
    const result = normalizeFilterRows(input, testEntity);
    expect(result).toHaveLength(1);
    expect(result[0].active).toBe(true);
  });

  it("drops rows that are not objects or lack required string fields", () => {
    const input = [
      null,
      "string",
      { id: 123, property: "title", operator: "contains", value: "", active: true }, // invalid id
      { id: "f1", property: 42, operator: "contains", value: "", active: true }, // invalid property
      { id: "f2", property: "title", operator: 99, value: "", active: true }, // invalid operator
      { id: "f3", property: "title", operator: "contains", value: "ok", active: true }, // valid
    ];
    const result = normalizeFilterRows(input, testEntity);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("f3");
  });
});

// -----------------------------------------------------------------------
// addFilter
// -----------------------------------------------------------------------

describe("addFilter", () => {
  it("inserts a row with first filterable property and default operator", () => {
    const result = addFilter([], testEntity);
    expect(result).toHaveLength(1);
    const row = result[0];
    expect(row.property).toBe("title"); // first filterable property
    expect(typeof row.id).toBe("string");
    expect(row.active).toBe(true);
    // default operator for text is "contains"
    expect(row.operator).toBe("contains");
  });

  it("appends a new row to existing rows", () => {
    const existing: FilterConfig[] = [
      { id: "f1", property: "status", operator: "is", value: "Done", active: true },
    ];
    const result = addFilter(existing, testEntity);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("f1");
  });

  it("returns rows unchanged when no filterable properties", () => {
    const rows: FilterConfig[] = [];
    const result = addFilter(rows, entityNoFilterable);
    expect(result).toEqual([]);
  });
});

// -----------------------------------------------------------------------
// updateFilterProperty
// -----------------------------------------------------------------------

describe("updateFilterProperty", () => {
  it("resets operator and value to defaults for new property", () => {
    const rows: FilterConfig[] = [
      { id: "f1", property: "title", operator: "contains", value: "hello", active: true },
    ];
    const result = updateFilterProperty(rows, "f1", "status", testEntity);
    expect(result).toHaveLength(1);
    expect(result[0].property).toBe("status");
    // default operator for select is "contains"
    expect(result[0].operator).toBe("contains");
    // value reset for multi-select control
    expect(result[0].value).toEqual([]);
  });

  it("returns rows unchanged for unknown rowId", () => {
    const rows: FilterConfig[] = [
      { id: "f1", property: "title", operator: "contains", value: "hello", active: true },
    ];
    const result = updateFilterProperty(rows, "unknown", "status", testEntity);
    expect(result).toEqual(rows);
  });

  it("returns rows unchanged for unknown new property", () => {
    const rows: FilterConfig[] = [
      { id: "f1", property: "title", operator: "contains", value: "hello", active: true },
    ];
    const result = updateFilterProperty(rows, "f1", "nonexistent", testEntity);
    expect(result).toEqual(rows);
  });
});

// -----------------------------------------------------------------------
// updateFilterOperator
// -----------------------------------------------------------------------

describe("updateFilterOperator", () => {
  it("resets value when operator changes", () => {
    const rows: FilterConfig[] = [
      { id: "f1", property: "title", operator: "contains", value: "hello", active: true },
    ];
    // "empty" has valueControl "none" → value resets to null
    const result = updateFilterOperator(rows, "f1", "empty", testEntity);
    expect(result).toHaveLength(1);
    expect(result[0].operator).toBe("empty");
    expect(result[0].value).toBeNull();
  });

  it("returns rows unchanged for unknown rowId", () => {
    const rows: FilterConfig[] = [
      { id: "f1", property: "title", operator: "contains", value: "hello", active: true },
    ];
    expect(updateFilterOperator(rows, "unknown", "empty", testEntity)).toEqual(rows);
  });

  it("returns rows unchanged for invalid operator for kind", () => {
    const rows: FilterConfig[] = [
      { id: "f1", property: "title", operator: "contains", value: "hello", active: true },
    ];
    // "eq" is not a valid text operator
    expect(updateFilterOperator(rows, "f1", "eq", testEntity)).toEqual(rows);
  });
});

// -----------------------------------------------------------------------
// updateFilterValue
// -----------------------------------------------------------------------

describe("updateFilterValue", () => {
  it("replaces the value for the matching row", () => {
    const rows: FilterConfig[] = [
      { id: "f1", property: "title", operator: "contains", value: "", active: true },
      { id: "f2", property: "status", operator: "is", value: null, active: true },
    ];
    const result = updateFilterValue(rows, "f1", "new value");
    expect(result[0].value).toBe("new value");
    expect(result[1].value).toBeNull();
  });

  it("returns rows unchanged for unknown rowId", () => {
    const rows: FilterConfig[] = [
      { id: "f1", property: "title", operator: "contains", value: "", active: true },
    ];
    expect(updateFilterValue(rows, "unknown", "x")).toEqual(rows);
  });
});

// -----------------------------------------------------------------------
// removeFilter
// -----------------------------------------------------------------------

describe("removeFilter", () => {
  it("removes only the matching row", () => {
    const rows: FilterConfig[] = [
      { id: "f1", property: "title", operator: "contains", value: "", active: true },
      { id: "f2", property: "status", operator: "is", value: null, active: true },
    ];
    const result = removeFilter(rows, "f1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("f2");
  });

  it("returns the same rows when rowId not found", () => {
    const rows: FilterConfig[] = [
      { id: "f1", property: "title", operator: "contains", value: "", active: true },
    ];
    const result = removeFilter(rows, "unknown");
    expect(result).toHaveLength(1);
  });
});

// -----------------------------------------------------------------------
// clearFilters
// -----------------------------------------------------------------------

describe("clearFilters", () => {
  it("returns []", () => {
    expect(clearFilters()).toEqual([]);
  });
});

// -----------------------------------------------------------------------
// isFilterComplete
// -----------------------------------------------------------------------

describe("isFilterComplete", () => {
  it("is complete for empty/not-empty operators without values", () => {
    const row: FilterConfig = { id: "f1", property: "title", operator: "empty", value: null, active: true };
    expect(isFilterComplete(row, testEntity)).toBe(true);

    const row2: FilterConfig = { id: "f2", property: "title", operator: "not-empty", value: null, active: true };
    expect(isFilterComplete(row2, testEntity)).toBe(true);
  });

  it("is complete for text contains with non-empty value", () => {
    const row: FilterConfig = { id: "f1", property: "title", operator: "contains", value: "hello", active: true };
    expect(isFilterComplete(row, testEntity)).toBe(true);
  });

  it("is incomplete for text contains with empty string value", () => {
    const row: FilterConfig = { id: "f1", property: "title", operator: "contains", value: "", active: true };
    expect(isFilterComplete(row, testEntity)).toBe(false);
  });

  it("is incomplete for text contains with whitespace-only value", () => {
    const row: FilterConfig = { id: "f1", property: "title", operator: "contains", value: "   ", active: true };
    expect(isFilterComplete(row, testEntity)).toBe(false);
  });

  it("is incomplete for unknown property", () => {
    const row: FilterConfig = { id: "f1", property: "nonexistent", operator: "contains", value: "hello", active: true };
    expect(isFilterComplete(row, testEntity)).toBe(false);
  });

  it("is incomplete for unknown operator", () => {
    const row: FilterConfig = { id: "f1", property: "title", operator: "invalid-op", value: "hello", active: true };
    expect(isFilterComplete(row, testEntity)).toBe(false);
  });

  it("is complete for select is with non-null value", () => {
    const row: FilterConfig = { id: "f1", property: "status", operator: "is", value: "Done", active: true };
    expect(isFilterComplete(row, testEntity)).toBe(true);
  });

  it("is incomplete for select is with null value", () => {
    const row: FilterConfig = { id: "f1", property: "status", operator: "is", value: null, active: true };
    expect(isFilterComplete(row, testEntity)).toBe(false);
  });

  it("is complete for select contains with non-empty array", () => {
    const row: FilterConfig = { id: "f1", property: "status", operator: "contains", value: ["Done"], active: true };
    expect(isFilterComplete(row, testEntity)).toBe(true);
  });

  it("is incomplete for select contains with empty array", () => {
    const row: FilterConfig = { id: "f1", property: "status", operator: "contains", value: [], active: true };
    expect(isFilterComplete(row, testEntity)).toBe(false);
  });

  it("is complete for date with non-null value", () => {
    const row: FilterConfig = { id: "f1", property: "updated", operator: "is", value: "2024-01-01", active: true };
    expect(isFilterComplete(row, testEntity)).toBe(true);
  });

  it("is incomplete for date with null value", () => {
    const row: FilterConfig = { id: "f1", property: "updated", operator: "is", value: null, active: true };
    expect(isFilterComplete(row, testEntity)).toBe(false);
  });
});

// -----------------------------------------------------------------------
// summarizeFilters
// -----------------------------------------------------------------------

describe("summarizeFilters", () => {
  it('returns "None" for empty rows', () => {
    expect(summarizeFilters([], testEntity)).toBe("None");
  });

  it('returns "1 active" for one complete active filter', () => {
    const rows: FilterConfig[] = [
      { id: "f1", property: "title", operator: "contains", value: "hello", active: true },
    ];
    expect(summarizeFilters(rows, testEntity)).toBe("1 active");
  });

  it('returns "N active" for multiple complete active filters', () => {
    const rows: FilterConfig[] = [
      { id: "f1", property: "title", operator: "contains", value: "hello", active: true },
      { id: "f2", property: "title", operator: "not-empty", value: null, active: true },
    ];
    expect(summarizeFilters(rows, testEntity)).toBe("2 active");
  });

  it("counts only active and complete rows", () => {
    const rows: FilterConfig[] = [
      { id: "f1", property: "title", operator: "contains", value: "hello", active: true },  // active + complete
      { id: "f2", property: "title", operator: "contains", value: "", active: true },         // active but incomplete
      { id: "f3", property: "title", operator: "not-empty", value: null, active: false },     // inactive
      { id: "f4", property: "title", operator: "not-empty", value: null, active: true },      // active + complete
    ];
    expect(summarizeFilters(rows, testEntity)).toBe("2 active");
  });

  it('returns "None" when all rows are inactive', () => {
    const rows: FilterConfig[] = [
      { id: "f1", property: "title", operator: "contains", value: "hello", active: false },
    ];
    expect(summarizeFilters(rows, testEntity)).toBe("None");
  });
});
