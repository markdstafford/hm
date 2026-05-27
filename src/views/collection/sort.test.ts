import { describe, it, expect } from "vitest";
import type { EntityContract } from "./types";
import { buildCollectionComparator, sortCollectionItems } from "./sort";

type Item = { id: string; status: string; updated: string | null; sequence: number };
type Prop = "status" | "updated";

const entity: EntityContract<Item, Prop> = {
  id: "fixture",
  label: "Fixture",
  getId: (item) => item.id,
  properties: [
    { id: "status", label: "Status", kind: "categorical", renderCell: ({ item }) => item.status },
    { id: "updated", label: "Updated", kind: "date", renderCell: ({ item }) => item.updated },
  ],
  defaultProperties: [
    { property: "status", side: "left", visible: true },
    { property: "updated", side: "right", visible: true },
  ],
  defaultSort: (a, b) => a.sequence - b.sequence,
  sortableProperties: [
    { property: "status", compare: (a, b) => a.status.localeCompare(b.status) },
    {
      property: "updated",
      compare: (a, b) => {
        if (a.updated === null && b.updated === null) return 0;
        if (a.updated === null) return 1;
        if (b.updated === null) return -1;
        return new Date(a.updated).getTime() - new Date(b.updated).getTime();
      },
    },
  ],
  Detail: () => null,
  defaultViews: [],
};

const items: Item[] = [
  { id: "c", status: "Open", updated: "2024-01-01T00:00:00Z", sequence: 3 },
  { id: "a", status: "Done", updated: "2024-03-01T00:00:00Z", sequence: 1 },
  { id: "b", status: "Done", updated: "2024-01-01T00:00:00Z", sequence: 2 },
];

describe("buildCollectionComparator", () => {
  it("applies multi-level sort in stack order", () => {
    const sorted = sortCollectionItems(items, entity, [
      { property: "status", direction: "asc" },
      { property: "updated", direction: "desc" },
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("inverts comparator output for descending levels", () => {
    const comparator = buildCollectionComparator([{ property: "status", direction: "desc" }], entity);
    // "Open" > "Done" ascending, so desc should put "Open" first
    // items[0] is {status:"Open"}, items[1] is {status:"Done"}
    // desc: Open before Done, so comparator(items[0], items[1]) < 0
    expect(comparator(items[0], items[1])).toBeLessThan(0);
  });

  it("falls back to entity.defaultSort after configured levels tie", () => {
    const alpha = { id: "alpha", status: "Open", updated: null, sequence: 1 };
    const beta = { id: "beta", status: "Open", updated: null, sequence: 2 };

    expect(buildCollectionComparator([{ property: "status", direction: "asc" }], entity)(beta, alpha)).toBeGreaterThan(0);
  });

  it("ignores stale configured sort properties and uses default sort", () => {
    const sorted = sortCollectionItems(items, entity, [{ property: "missing" as Prop, direction: "asc" }]);
    expect(sorted.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("returns a sorted copy without mutating the input array", () => {
    const original = [...items];
    const sorted = sortCollectionItems(items, entity, []);

    expect(sorted).not.toBe(items);
    expect(items).toEqual(original);
    expect(sorted.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });
});
