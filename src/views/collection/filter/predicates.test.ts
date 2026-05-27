import { describe, expect, it } from "vitest";
import { filterMatchesItem, filterCollectionItems } from "./predicates";
import type { EntityContract, FilterableProperty } from "../types";
import type { FilterConfig } from "../ViewConfig";

// -------------------------------------------------------------------------
// Test entity setup
// -------------------------------------------------------------------------

type TestItem = {
  id: string;
  title: string;
  status: string;
  labels: string[];
  updatedAt: string;
  assignee: string;
  score: number | null;
  done: boolean;
};

type TestProperty = "title" | "status" | "labels" | "updatedAt" | "assignee" | "score" | "done";

const filterableProperties: FilterableProperty<TestItem, TestProperty>[] = [
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
    property: "labels",
    kind: "multi-select",
    getValue: (item) => item.labels,
  },
  {
    property: "updatedAt",
    kind: "date",
    getValue: (item) => item.updatedAt,
  },
  {
    property: "assignee",
    kind: "person",
    getValue: (item) => item.assignee,
  },
  {
    property: "score",
    kind: "number",
    getValue: (item) => item.score,
  },
  {
    property: "done",
    kind: "checkbox",
    getValue: (item) => item.done,
  },
];

const entity: EntityContract<TestItem, TestProperty> = {
  id: "test-entity",
  label: "Test",
  getId: (item) => item.id,
  properties: [],
  defaultProperties: [],
  defaultSort: () => 0,
  filterableProperties,
  Detail: () => null,
  defaultViews: [],
};

// -------------------------------------------------------------------------
// Helper to build a FilterConfig row
// -------------------------------------------------------------------------

function makeFilter(
  property: TestProperty,
  operator: string,
  value: unknown,
  active = true,
  id = "f1",
): FilterConfig {
  return { id, property, operator, value, active };
}

// -------------------------------------------------------------------------
// Sample items
// -------------------------------------------------------------------------

const ITEM_A: TestItem = {
  id: "a",
  title: "Hello World",
  status: "in-progress",
  labels: ["bug", "urgent"],
  updatedAt: "2026-05-15",
  assignee: "Alice Smith",
  score: 42,
  done: false,
};

const ITEM_B: TestItem = {
  id: "b",
  title: "Foo Bar",
  status: "done",
  labels: ["feature"],
  updatedAt: "2026-03-01",
  assignee: "Bob Jones",
  score: 10,
  done: true,
};

const ITEM_C: TestItem = {
  id: "c",
  title: "",
  status: "",
  labels: [],
  updatedAt: "2026-05-27",
  assignee: "",
  score: null,
  done: false,
};

const NOW = new Date(2026, 4, 27, 12, 0, 0); // May 27 2026

// -------------------------------------------------------------------------
// Text predicates
// -------------------------------------------------------------------------

describe("text predicates", () => {
  it("contains - case-insensitive match", () => {
    expect(filterMatchesItem({ row: makeFilter("title", "contains", "hello"), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("title", "contains", "Hello"), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("title", "contains", "xyz"), item: ITEM_A, entity })).toBe(false);
  });

  it("does-not-contain", () => {
    expect(filterMatchesItem({ row: makeFilter("title", "does-not-contain", "xyz"), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("title", "does-not-contain", "hello"), item: ITEM_A, entity })).toBe(false);
  });

  it("is - exact match case-insensitive", () => {
    expect(filterMatchesItem({ row: makeFilter("title", "is", "hello world"), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("title", "is", "Hello World"), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("title", "is", "hello"), item: ITEM_A, entity })).toBe(false);
  });

  it("is-not", () => {
    expect(filterMatchesItem({ row: makeFilter("title", "is-not", "hello world"), item: ITEM_A, entity })).toBe(false);
    expect(filterMatchesItem({ row: makeFilter("title", "is-not", "other"), item: ITEM_A, entity })).toBe(true);
  });

  it("starts-with", () => {
    expect(filterMatchesItem({ row: makeFilter("title", "starts-with", "hello"), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("title", "starts-with", "world"), item: ITEM_A, entity })).toBe(false);
  });

  it("ends-with", () => {
    expect(filterMatchesItem({ row: makeFilter("title", "ends-with", "world"), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("title", "ends-with", "hello"), item: ITEM_A, entity })).toBe(false);
  });

  it("empty - matches item with empty title", () => {
    expect(filterMatchesItem({ row: makeFilter("title", "empty", null), item: ITEM_C, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("title", "empty", null), item: ITEM_A, entity })).toBe(false);
  });

  it("not-empty - matches item with non-empty title", () => {
    expect(filterMatchesItem({ row: makeFilter("title", "not-empty", null), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("title", "not-empty", null), item: ITEM_C, entity })).toBe(false);
  });
});

// -------------------------------------------------------------------------
// Number predicates
// -------------------------------------------------------------------------

describe("number predicates", () => {
  it("eq", () => {
    expect(filterMatchesItem({ row: makeFilter("score", "eq", "42"), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("score", "eq", "10"), item: ITEM_A, entity })).toBe(false);
  });

  it("neq", () => {
    expect(filterMatchesItem({ row: makeFilter("score", "neq", "10"), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("score", "neq", "42"), item: ITEM_A, entity })).toBe(false);
  });

  it("gt", () => {
    expect(filterMatchesItem({ row: makeFilter("score", "gt", "40"), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("score", "gt", "42"), item: ITEM_A, entity })).toBe(false);
  });

  it("lt", () => {
    expect(filterMatchesItem({ row: makeFilter("score", "lt", "43"), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("score", "lt", "42"), item: ITEM_A, entity })).toBe(false);
  });

  it("gte", () => {
    expect(filterMatchesItem({ row: makeFilter("score", "gte", "42"), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("score", "gte", "43"), item: ITEM_A, entity })).toBe(false);
  });

  it("lte", () => {
    expect(filterMatchesItem({ row: makeFilter("score", "lte", "42"), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("score", "lte", "41"), item: ITEM_A, entity })).toBe(false);
  });

  it("empty - matches null score", () => {
    expect(filterMatchesItem({ row: makeFilter("score", "empty", null), item: ITEM_C, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("score", "empty", null), item: ITEM_A, entity })).toBe(false);
  });

  it("not-empty - matches non-null score", () => {
    expect(filterMatchesItem({ row: makeFilter("score", "not-empty", null), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("score", "not-empty", null), item: ITEM_C, entity })).toBe(false);
  });
});

// -------------------------------------------------------------------------
// Select predicates
// -------------------------------------------------------------------------

describe("select predicates", () => {
  it("is", () => {
    expect(filterMatchesItem({ row: makeFilter("status", "is", "in-progress"), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("status", "is", "done"), item: ITEM_A, entity })).toBe(false);
  });

  it("is-not", () => {
    expect(filterMatchesItem({ row: makeFilter("status", "is-not", "done"), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("status", "is-not", "in-progress"), item: ITEM_A, entity })).toBe(false);
  });

  it("contains (multi-value) - matches any in array", () => {
    expect(filterMatchesItem({ row: makeFilter("status", "contains", ["in-progress", "done"]), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("status", "contains", ["done"]), item: ITEM_A, entity })).toBe(false);
  });

  it("does-not-contain (multi-value) - item value not in array", () => {
    expect(filterMatchesItem({ row: makeFilter("status", "does-not-contain", ["done"]), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("status", "does-not-contain", ["in-progress"]), item: ITEM_A, entity })).toBe(false);
  });

  it("empty - matches empty status", () => {
    expect(filterMatchesItem({ row: makeFilter("status", "empty", null), item: ITEM_C, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("status", "empty", null), item: ITEM_A, entity })).toBe(false);
  });

  it("not-empty - matches non-empty status", () => {
    expect(filterMatchesItem({ row: makeFilter("status", "not-empty", null), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("status", "not-empty", null), item: ITEM_C, entity })).toBe(false);
  });
});

// -------------------------------------------------------------------------
// Multi-select predicates
// -------------------------------------------------------------------------

describe("multi-select predicates", () => {
  it("contains - any overlap", () => {
    expect(filterMatchesItem({ row: makeFilter("labels", "contains", ["bug"]), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("labels", "contains", ["bug", "feature"]), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("labels", "contains", ["feature"]), item: ITEM_A, entity })).toBe(false);
  });

  it("does-not-contain - no overlap", () => {
    expect(filterMatchesItem({ row: makeFilter("labels", "does-not-contain", ["feature"]), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("labels", "does-not-contain", ["bug"]), item: ITEM_A, entity })).toBe(false);
  });

  it("empty - matches item with no labels", () => {
    expect(filterMatchesItem({ row: makeFilter("labels", "empty", null), item: ITEM_C, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("labels", "empty", null), item: ITEM_A, entity })).toBe(false);
  });

  it("not-empty - matches item with labels", () => {
    expect(filterMatchesItem({ row: makeFilter("labels", "not-empty", null), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("labels", "not-empty", null), item: ITEM_C, entity })).toBe(false);
  });
});

// -------------------------------------------------------------------------
// Date predicates
// -------------------------------------------------------------------------

describe("date predicates", () => {
  it("is - exact date match", () => {
    expect(filterMatchesItem({ row: makeFilter("updatedAt", "is", "2026-05-15"), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("updatedAt", "is", "2026-05-16"), item: ITEM_A, entity })).toBe(false);
  });

  it("before", () => {
    expect(filterMatchesItem({ row: makeFilter("updatedAt", "before", "2026-05-16"), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("updatedAt", "before", "2026-05-15"), item: ITEM_A, entity })).toBe(false);
  });

  it("after", () => {
    expect(filterMatchesItem({ row: makeFilter("updatedAt", "after", "2026-05-14"), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("updatedAt", "after", "2026-05-15"), item: ITEM_A, entity })).toBe(false);
  });

  it("on-or-before", () => {
    expect(filterMatchesItem({ row: makeFilter("updatedAt", "on-or-before", "2026-05-15"), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("updatedAt", "on-or-before", "2026-05-14"), item: ITEM_A, entity })).toBe(false);
  });

  it("on-or-after", () => {
    expect(filterMatchesItem({ row: makeFilter("updatedAt", "on-or-after", "2026-05-15"), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("updatedAt", "on-or-after", "2026-05-16"), item: ITEM_A, entity })).toBe(false);
  });

  it("within past-month (inject NOW)", () => {
    // ITEM_A updatedAt is 2026-05-15, within past month from May 27
    expect(filterMatchesItem({
      row: makeFilter("updatedAt", "within", "past-month"),
      item: ITEM_A,
      entity,
      context: { now: NOW },
    })).toBe(true);
    // ITEM_B updatedAt is 2026-03-01, outside past month
    expect(filterMatchesItem({
      row: makeFilter("updatedAt", "within", "past-month"),
      item: ITEM_B,
      entity,
      context: { now: NOW },
    })).toBe(false);
    // ITEM_C updatedAt is 2026-05-27, today - inside past month
    expect(filterMatchesItem({
      row: makeFilter("updatedAt", "within", "past-month"),
      item: ITEM_C,
      entity,
      context: { now: NOW },
    })).toBe(true);
  });

  it("empty - no parseable date", () => {
    const itemNoDate: TestItem = { ...ITEM_A, updatedAt: "" };
    expect(filterMatchesItem({ row: makeFilter("updatedAt", "empty", null), item: itemNoDate, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("updatedAt", "empty", null), item: ITEM_A, entity })).toBe(false);
  });

  it("not-empty - has parseable date", () => {
    expect(filterMatchesItem({ row: makeFilter("updatedAt", "not-empty", null), item: ITEM_A, entity })).toBe(true);
    const itemNoDate: TestItem = { ...ITEM_A, updatedAt: "" };
    expect(filterMatchesItem({ row: makeFilter("updatedAt", "not-empty", null), item: itemNoDate, entity })).toBe(false);
  });
});

// -------------------------------------------------------------------------
// Person predicates
// -------------------------------------------------------------------------

describe("person predicates", () => {
  it("contains - substring match", () => {
    expect(filterMatchesItem({ row: makeFilter("assignee", "contains", "alice"), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("assignee", "contains", "bob"), item: ITEM_A, entity })).toBe(false);
  });

  it("does-not-contain", () => {
    expect(filterMatchesItem({ row: makeFilter("assignee", "does-not-contain", "bob"), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("assignee", "does-not-contain", "alice"), item: ITEM_A, entity })).toBe(false);
  });

  it("empty", () => {
    expect(filterMatchesItem({ row: makeFilter("assignee", "empty", null), item: ITEM_C, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("assignee", "empty", null), item: ITEM_A, entity })).toBe(false);
  });

  it("not-empty", () => {
    expect(filterMatchesItem({ row: makeFilter("assignee", "not-empty", null), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("assignee", "not-empty", null), item: ITEM_C, entity })).toBe(false);
  });
});

// -------------------------------------------------------------------------
// Checkbox predicates
// -------------------------------------------------------------------------

describe("checkbox predicates", () => {
  it("is - matches checked items", () => {
    expect(filterMatchesItem({ row: makeFilter("done", "is", null), item: ITEM_B, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("done", "is", null), item: ITEM_A, entity })).toBe(false);
  });

  it("is-not - matches unchecked items", () => {
    expect(filterMatchesItem({ row: makeFilter("done", "is-not", null), item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: makeFilter("done", "is-not", null), item: ITEM_B, entity })).toBe(false);
  });
});

// -------------------------------------------------------------------------
// Inactive / incomplete filters are ignored
// -------------------------------------------------------------------------

describe("inactive filter is ignored", () => {
  it("returns true for all items when filter is inactive", () => {
    const inactiveFilter = makeFilter("title", "contains", "xyz", false);
    expect(filterMatchesItem({ row: inactiveFilter, item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: inactiveFilter, item: ITEM_B, entity })).toBe(true);
  });
});

describe("incomplete filter is ignored", () => {
  it("returns true when filter value is empty string (requires value)", () => {
    const incompleteFilter = makeFilter("title", "contains", "");
    expect(filterMatchesItem({ row: incompleteFilter, item: ITEM_A, entity })).toBe(true);
    expect(filterMatchesItem({ row: incompleteFilter, item: ITEM_B, entity })).toBe(true);
  });

  it("returns true when filter has unknown property", () => {
    const unknownPropFilter = makeFilter("title", "contains", "hello");
    // Modify to use unknown property
    const row = { ...unknownPropFilter, property: "nonexistent" };
    expect(filterMatchesItem({ row, item: ITEM_A, entity })).toBe(true);
  });
});

// -------------------------------------------------------------------------
// filterCollectionItems
// -------------------------------------------------------------------------

describe("filterCollectionItems", () => {
  const items = [ITEM_A, ITEM_B, ITEM_C];

  it("returns all items when no filters", () => {
    expect(filterCollectionItems({ items, entity, filters: [] })).toEqual(items);
  });

  it("returns all items when all filters are incomplete/inactive", () => {
    const filters = [
      makeFilter("title", "contains", "", true, "f1"),
      makeFilter("status", "is", "", false, "f2"),
    ];
    expect(filterCollectionItems({ items, entity, filters })).toEqual(items);
  });

  it("AND-combines: item must match all active complete filters", () => {
    const filters = [
      makeFilter("title", "contains", "foo", true, "f1"),
      makeFilter("status", "is", "done", true, "f2"),
    ];
    // ITEM_B has title "Foo Bar" (contains "foo") AND status "done"
    const result = filterCollectionItems({ items, entity, filters });
    expect(result).toContain(ITEM_B);
    expect(result).not.toContain(ITEM_A);
    expect(result).not.toContain(ITEM_C);
  });

  it("single filter keeps only matching items", () => {
    const filters = [makeFilter("done", "is", null, true, "f1")];
    const result = filterCollectionItems({ items, entity, filters });
    expect(result).toEqual([ITEM_B]);
  });

  it("inactive filter does not exclude items", () => {
    const filters = [
      makeFilter("title", "contains", "xyz", false, "f1"),
    ];
    expect(filterCollectionItems({ items, entity, filters })).toEqual(items);
  });

  it("passes context to date within filter", () => {
    const filters = [makeFilter("updatedAt", "within", "past-month", true, "f1")];
    // With NOW: May 27 2026, past-month window is Apr 27 - May 27
    // ITEM_A: 2026-05-15 (in), ITEM_B: 2026-03-01 (out), ITEM_C: 2026-05-27 (in)
    const result = filterCollectionItems({ items, entity, filters, context: { now: NOW } });
    expect(result).toContain(ITEM_A);
    expect(result).not.toContain(ITEM_B);
    expect(result).toContain(ITEM_C);
  });
});
