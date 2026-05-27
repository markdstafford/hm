import { bucketCollectionItems, flattenBucketedGroups } from "./bucket";
import type { EntityContract } from "./types";

type Item = { id: string; status: string | null; rank: number };
type Prop = "status" | "rank";

const entity: EntityContract<Item, Prop> = {
  id: "test",
  label: "Items",
  getId: (item) => item.id,
  properties: [
    { id: "status", label: "Status", kind: "categorical", renderCell: ({ item }) => item.status },
    { id: "rank", label: "Rank", kind: "number", renderCell: ({ item }) => item.rank },
  ],
  defaultProperties: [],
  defaultSort: (a, b) => a.rank - b.rank,
  groupableProperties: [
    {
      property: "status",
      bucketKeyFor: (item) => item.status ?? "unknown",
      bucketOrder: () => [
        { key: "todo", label: "To do" },
        { key: "doing", label: "In progress" },
        { key: "done", label: "Done" },
      ],
      bucketLabelFor: (key) => (key === "surprise" ? "Surprise" : key),
    },
  ],
  Detail: () => null,
  defaultViews: [],
};

describe("bucketCollectionItems", () => {
  it("partitions items in declared bucket order and preserves input order within buckets", () => {
    const items = [
      { id: "a", status: "doing", rank: 2 },
      { id: "b", status: "todo", rank: 1 },
      { id: "c", status: "doing", rank: 3 },
    ];

    const groups = bucketCollectionItems({
      items,
      entity,
      group: { property: "status", hideEmptyGroups: true },
    });

    expect(groups.map((group) => [group.label, group.items.map((item) => item.id)])).toEqual([
      ["To do", ["b"]],
      ["In progress", ["a", "c"]],
    ]);
  });

  it("includes known empty buckets when hideEmptyGroups is false", () => {
    const groups = bucketCollectionItems({
      items: [{ id: "a", status: "todo", rank: 1 }],
      entity,
      group: { property: "status", hideEmptyGroups: false },
    });

    expect(groups.map((group) => [group.label, group.items.length])).toEqual([
      ["To do", 1],
      ["In progress", 0],
      ["Done", 0],
    ]);
  });

  it("places unknown buckets after known buckets sorted by display label", () => {
    const groups = bucketCollectionItems({
      items: [
        { id: "a", status: "todo", rank: 1 },
        { id: "b", status: "surprise", rank: 2 },
        { id: "c", status: "unknown", rank: 3 },
      ],
      entity,
      group: { property: "status", hideEmptyGroups: true },
    });

    expect(groups.map((group) => group.label)).toEqual(["To do", "Surprise", "unknown"]);
  });

  it("returns an empty array when grouping is inactive or invalid", () => {
    expect(
      bucketCollectionItems({ items: [], entity, group: { property: null, hideEmptyGroups: true } }),
    ).toEqual([]);
    expect(
      bucketCollectionItems({ items: [], entity, group: { property: "rank", hideEmptyGroups: true } }),
    ).toEqual([]);
  });

  it("catches errors from bucketKeyFor and assigns item to Unknown bucket", () => {
    const throwingEntity: EntityContract<Item, Prop> = {
      ...entity,
      groupableProperties: [
        {
          property: "status",
          bucketKeyFor: () => { throw new Error("bad item"); },
          bucketOrder: () => [{ key: "todo", label: "To do" }],
        },
      ],
    };

    const groups = bucketCollectionItems({
      items: [{ id: "a", status: "todo", rank: 1 }],
      entity: throwingEntity,
      group: { property: "status", hideEmptyGroups: true },
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("Unknown");
    expect(groups[0].items).toHaveLength(1);
  });

  it("does not mutate the input item array", () => {
    const items = [
      { id: "a", status: "todo", rank: 1 },
      { id: "b", status: "done", rank: 2 },
    ];
    const before = [...items];

    bucketCollectionItems({ items, entity, group: { property: "status", hideEmptyGroups: true } });

    expect(items).toEqual(before);
  });
});

describe("flattenBucketedGroups", () => {
  it("skips rows inside collapsed groups", () => {
    const groups = bucketCollectionItems({
      items: [
        { id: "a", status: "todo", rank: 1 },
        { id: "b", status: "doing", rank: 2 },
      ],
      entity,
      group: { property: "status", hideEmptyGroups: true },
    });

    expect(flattenBucketedGroups(groups, { collapsedGroupKeys: new Set(["todo"]) }).map((item) => item.id)).toEqual(["b"]);
  });
});
