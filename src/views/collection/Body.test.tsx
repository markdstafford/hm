import { render, screen } from "@testing-library/react";
import { Body, sortCollectionItems } from "./Body";
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

  it("applies defaultSort — rank ascending so Beta (1) comes before Alpha (2)", () => {
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
    expect(sortCollectionItems(items, entity).map((i) => i.id)).toEqual(["b", "a"]);
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
});
