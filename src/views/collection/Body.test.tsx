import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Body } from "./Body";
import { sortCollectionItems } from "./sort";
import type { EntityContract } from "./types";

type Item = { id: string; name: string; rank: number };
type Prop = "name" | "rank";

const entity: EntityContract<Item, Prop> = {
  id: "test",
  label: "Test",
  getId: (item) => item.id,
  properties: [
    {
      id: "name",
      label: "Name",
      kind: "text",
      renderCell: ({ item }) => <span>{item.name}</span>,
      isStretch: true,
    },
    {
      id: "rank",
      label: "Rank",
      kind: "number",
      renderCell: ({ item }) => <span>{item.rank}</span>,
    },
  ],
  defaultProperties: [
    { property: "name", side: "left", visible: true },
    { property: "rank", side: "right", visible: true },
  ],
  defaultSort: (a, b) => a.rank - b.rank,
  sortableProperties: [
    { property: "name", compare: (a, b) => a.name.localeCompare(b.name) },
    { property: "rank", compare: (a, b) => a.rank - b.rank },
  ],
  Detail: ({ item }) => <div>Detail: {item.name}</div>,
  defaultViews: [],
};

describe("Body", () => {
  it("renders EmptyState when items is empty", () => {
    render(
      <Body
        items={[]}
        entity={entity}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText(/no test yet/i)).toBeInTheDocument();
  });

  it("renders one row per item", () => {
    const items: Item[] = [
      { id: "a", name: "Alpha", rank: 2 },
      { id: "b", name: "Beta", rank: 1 },
    ];
    render(
      <Body
        items={items}
        entity={entity}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /open a/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open b/i })).toBeInTheDocument();
  });

  it("renders items in the order they are passed (caller is responsible for sorting)", () => {
    const unsortedItems: Item[] = [
      { id: "a", name: "Alpha", rank: 2 },
      { id: "b", name: "Beta", rank: 1 },
    ];
    // Pre-sort using sortCollectionItems to simulate what the parent does
    const items = sortCollectionItems(unsortedItems, entity, []);
    render(
      <Body
        items={items}
        entity={entity}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );
    const rows = screen.getAllByRole("button", { name: /open/i });
    expect(rows[0]).toHaveAttribute("aria-label", "Open b");
    expect(rows[1]).toHaveAttribute("aria-label", "Open a");
  });

  it("uses defaultProperties when no properties prop is provided", () => {
    const items: Item[] = [{ id: "x", name: "Xray", rank: 5 }];
    render(
      <Body
        items={items}
        entity={entity}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText("Xray")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("sortCollectionItems returns items sorted by entity.defaultSort (rank ascending)", () => {
    const items: Item[] = [
      { id: "a", name: "Alpha", rank: 2 },
      { id: "b", name: "Beta", rank: 1 },
    ];
    expect(sortCollectionItems(items, entity, []).map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("renders filtered empty state when items is empty but unfilteredCount > 0", () => {
    render(
      <Body
        items={[]}
        unfilteredCount={2}
        entity={entity}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("No matching Test")).toBeInTheDocument();
    expect(screen.getByText("Try changing or clearing filters for this view.")).toBeInTheDocument();
  });

  it("uses scoped filtered-empty copy for re-rooted collections", () => {
    render(
      <Body
        items={[]}
        unfilteredCount={2}
        scopedEmptyLabel="related items"
        entity={entity}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("No matching related items")).toBeInTheDocument();
    expect(screen.getByText("Try changing or clearing filters for this view.")).toBeInTheDocument();
  });

  it("passes compact density to row elements (py-1 present, py-2 absent)", () => {
    const items: Item[] = [{ id: "x", name: "Xray", rank: 5 }];
    const { container } = render(
      <Body items={items} entity={entity} selectedId={null} density="compact" onSelect={vi.fn()} />,
    );
    expect(container.querySelector(".py-1")).toBeInTheDocument();
    expect(container.querySelector(".py-2")).not.toBeInTheDocument();
    expect(container.querySelector(".px-3")).toBeInTheDocument();
  });

  it("uses the provided active property configuration instead of entity defaults", () => {
    const items: Item[] = [{ id: "x", name: "Xray", rank: 5 }];
    render(
      <Body
        items={items}
        entity={entity}
        selectedId={null}
        properties={[
          { property: "name", side: "left", visible: true },
          { property: "rank", side: "right", visible: false },
        ]}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Xray")).toBeInTheDocument();
    expect(screen.queryByText("5")).not.toBeInTheDocument();
  });

  it("renders grouped section headers when group prop is provided and hides empty buckets by default", () => {
    const groupedEntity = {
      ...entity,
      groupableProperties: [
        {
          property: "name" as Prop,
          bucketKeyFor: (item: Item) => (item.name.startsWith("A") ? "a" : "b"),
          bucketOrder: () => [
            { key: "a", label: "A names" },
            { key: "b", label: "B names" },
            { key: "c", label: "C names" },
          ],
        },
      ],
    };

    render(
      <Body
        items={[
          { id: "a", name: "Alpha", rank: 2 },
          { id: "b", name: "Beta", rank: 1 },
        ]}
        entity={groupedEntity}
        group={{ property: "name", hideEmptyGroups: true }}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("A names")).toBeInTheDocument();
    expect(screen.getByText("B names")).toBeInTheDocument();
    expect(screen.queryByText("C names")).not.toBeInTheDocument();
  });

  it("renders empty buckets with count zero when hideEmptyGroups is false", () => {
    const groupedEntity = {
      ...entity,
      groupableProperties: [
        {
          property: "name" as Prop,
          bucketKeyFor: (item: Item) => (item.name.startsWith("A") ? "a" : "b"),
          bucketOrder: () => [
            { key: "a", label: "A names" },
            { key: "b", label: "B names" },
          ],
        },
      ],
    };

    render(
      <Body
        items={[{ id: "a", name: "Alpha", rank: 2 }]}
        entity={groupedEntity}
        group={{ property: "name", hideEmptyGroups: false }}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("B names")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /collapse b names/i })).toBeInTheDocument();
  });

  it("collapses and expands grouped rows when the section chevron is toggled", async () => {
    const user = userEvent.setup();
    const groupedEntity = {
      ...entity,
      groupableProperties: [
        {
          property: "name" as Prop,
          bucketKeyFor: () => "a",
          bucketOrder: () => [{ key: "a", label: "A names" }],
        },
      ],
    };

    render(
      <Body
        items={[{ id: "a", name: "Alpha", rank: 2 }]}
        entity={groupedEntity}
        group={{ property: "name", hideEmptyGroups: true }}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );

    // Initially expanded: row is visible
    expect(screen.getByRole("button", { name: /open a/i })).toBeInTheDocument();

    // Collapse
    await user.click(screen.getByRole("button", { name: /collapse a names/i }));
    expect(screen.queryByRole("button", { name: /open a/i })).not.toBeInTheDocument();

    // Expand again
    await user.click(screen.getByRole("button", { name: /expand a names/i }));
    expect(screen.getByRole("button", { name: /open a/i })).toBeInTheDocument();
  });

  it("renders flat rows when group prop is not provided or property is null", () => {
    render(
      <Body
        items={[
          { id: "a", name: "Alpha", rank: 2 },
          { id: "b", name: "Beta", rank: 1 },
        ]}
        entity={entity}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /open a/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open b/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /collapse/i })).not.toBeInTheDocument();
  });

  it("threads selection props to flat rows", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <Body
        items={[{ id: "a", name: "Alpha", rank: 2 }]}
        entity={entity}
        selectedId={null}
        selection={{
          selectedIds: new Set(["a"]),
          onToggle,
          getLabel: (item) => `Select ${item.name}`,
        }}
        onSelect={vi.fn()}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Select Alpha" });
    expect(checkbox).toHaveAttribute("data-state", "checked");

    await user.click(checkbox);

    expect(onToggle).toHaveBeenCalledWith({ id: "a", name: "Alpha", rank: 2 });
  });

  it("threads selection props to grouped rows", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const groupedEntity = {
      ...entity,
      groupableProperties: [
        {
          property: "name" as Prop,
          bucketKeyFor: () => "a",
          bucketOrder: () => [{ key: "a", label: "A names" }],
        },
      ],
    };

    render(
      <Body
        items={[{ id: "a", name: "Alpha", rank: 2 }]}
        entity={groupedEntity}
        group={{ property: "name", hideEmptyGroups: true }}
        selectedId={null}
        selection={{
          selectedIds: new Set<string>(),
          onToggle,
          getLabel: (item) => `Select ${item.name}`,
        }}
        onSelect={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Select Alpha" }));

    expect(onToggle).toHaveBeenCalledWith({ id: "a", name: "Alpha", rank: 2 });
  });
});
