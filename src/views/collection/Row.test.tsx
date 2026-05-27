import { render, screen, fireEvent } from "@testing-library/react";
import { Row } from "./Row";
import type { EntityContract } from "./types";

type Item = { id: string; name: string; count: number };
type Prop = "name" | "count";

const entity: EntityContract<Item, Prop> = {
  id: "test",
  label: "Test",
  getId: (item) => item.id,
  properties: [
    {
      id: "name",
      label: "Name",
      kind: "text",
      renderCell: ({ item }) => <span data-testid="cell-name">{item.name}</span>,
      isStretch: true,
    },
    {
      id: "count",
      label: "Count",
      kind: "number",
      renderCell: ({ item }) => <span data-testid="cell-count">{item.count}</span>,
    },
  ],
  defaultProperties: [
    { property: "name", side: "left", visible: true },
    { property: "count", side: "right", visible: true },
  ],
  defaultSort: (a, b) => a.name.localeCompare(b.name),
  Detail: ({ item }) => <div>Detail: {item.name}</div>,
  defaultViews: [],
};

const item: Item = { id: "item-1", name: "Alpha", count: 42 };

describe("Row", () => {
  it("renders one visible left and one visible right property", () => {
    const onSelect = vi.fn();
    render(
      <Row
        item={item}
        entity={entity}
        properties={entity.defaultProperties}
        selectedId={null}
        onSelect={onSelect}
      />
    );
    expect(screen.getByTestId("cell-name")).toBeInTheDocument();
    expect(screen.getByTestId("cell-count")).toBeInTheDocument();
  });

  it("renders all properties when all visible", () => {
    const onSelect = vi.fn();
    const allVisible = [
      { property: "name" as Prop, side: "left" as const, visible: true },
      { property: "count" as Prop, side: "right" as const, visible: true },
    ];
    render(
      <Row
        item={item}
        entity={entity}
        properties={allVisible}
        selectedId={null}
        onSelect={onSelect}
      />
    );
    expect(screen.getAllByTestId(/cell-/)).toHaveLength(2);
  });

  it("all hidden except title: only title cell renders", () => {
    const onSelect = vi.fn();
    const titleOnlyProps = [
      { property: "name" as Prop, side: "left" as const, visible: true },
      { property: "count" as Prop, side: "right" as const, visible: false },
    ];
    render(
      <Row
        item={item}
        entity={entity}
        properties={titleOnlyProps}
        selectedId={null}
        onSelect={onSelect}
      />
    );
    expect(screen.getByTestId("cell-name")).toBeInTheDocument();
    expect(screen.queryByTestId("cell-count")).not.toBeInTheDocument();
  });

  it("title-only layout: stretch property wrapping span has flex-1 class", () => {
    const onSelect = vi.fn();
    const titleOnlyProps = [
      { property: "name" as Prop, side: "left" as const, visible: true },
      { property: "count" as Prop, side: "right" as const, visible: false },
    ];
    render(
      <Row
        item={item}
        entity={entity}
        properties={titleOnlyProps}
        selectedId={null}
        onSelect={onSelect}
      />
    );
    // The isStretch property is wrapped in a span with flex-1; its rendered child has data-testid
    expect(screen.getByTestId("cell-name").parentElement).toHaveClass("flex-1");
  });

  it("calls onSelect when the row body is clicked", () => {
    const onSelect = vi.fn();
    render(
      <Row
        item={item}
        entity={entity}
        properties={entity.defaultProperties}
        selectedId={null}
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /open item-1/i }));
    expect(onSelect).toHaveBeenCalledWith(item);
  });

  it("does not call onSelect when the checkbox placeholder is clicked", () => {
    const onSelect = vi.fn();
    render(
      <Row
        item={item}
        entity={entity}
        properties={entity.defaultProperties}
        selectedId={null}
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /select.*coming soon/i }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("applies selected styling when selectedId matches", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <Row
        item={item}
        entity={entity}
        properties={entity.defaultProperties}
        selectedId="item-1"
        onSelect={onSelect}
      />
    );
    expect(container.firstChild).toHaveClass("bg-surface-1");
  });

  it("uses entity.getRowLabel for the row button accessible name when provided", () => {
    const onSelect = vi.fn();
    const entityWithLabel: EntityContract<Item, Prop> = {
      ...entity,
      getRowLabel: (i) => `Open ${i.name} (${i.id})`,
    };
    render(
      <Row
        item={item}
        entity={entityWithLabel}
        properties={entity.defaultProperties}
        selectedId={null}
        onSelect={onSelect}
      />
    );
    expect(screen.getByRole("button", { name: /open alpha \(item-1\)/i })).toBeInTheDocument();
  });

  it("falls back to Open {id} for the row button accessible name when getRowLabel is absent", () => {
    const onSelect = vi.fn();
    render(
      <Row
        item={item}
        entity={entity}
        properties={entity.defaultProperties}
        selectedId={null}
        onSelect={onSelect}
      />
    );
    expect(screen.getByRole("button", { name: /open item-1/i })).toBeInTheDocument();
  });

  it("hides only the active grouped property cell without mutating property visibility", () => {
    const onSelect = vi.fn();
    const properties = entity.defaultProperties;

    render(
      <Row
        item={item}
        entity={entity}
        properties={properties}
        groupedPropertyId="count"
        selectedId={null}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByTestId("cell-name")).toBeInTheDocument();
    expect(screen.queryByTestId("cell-count")).not.toBeInTheDocument();
    // Verify properties array not mutated
    expect(properties).toEqual(entity.defaultProperties);
  });

  it("does not crash when a property id is not in entity.properties", () => {
    const onSelect = vi.fn();
    const unknownProp = [
      { property: "name" as Prop, side: "left" as const, visible: true },
      { property: "nonexistent" as Prop, side: "right" as const, visible: true },
    ];
    expect(() =>
      render(
        <Row
          item={item}
          entity={entity}
          properties={unknownProp}
          selectedId={null}
          onSelect={onSelect}
        />
      )
    ).not.toThrow();
  });

  it("uses regular vertical padding (py-2) by default while keeping horizontal padding (px-3)", () => {
    const { container } = render(
      <Row item={item} entity={entity} properties={entity.defaultProperties} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(container.firstChild).toHaveClass("px-3");
    expect(container.firstChild).toHaveClass("py-2");
    expect(container.firstChild).not.toHaveClass("py-1");
    expect(container.firstChild).not.toHaveClass("py-1.5");
  });

  it("uses compact vertical padding (py-1) without changing horizontal padding (px-3)", () => {
    const { container } = render(
      <Row item={item} entity={entity} properties={entity.defaultProperties} selectedId={null} density="compact" onSelect={vi.fn()} />,
    );
    expect(container.firstChild).toHaveClass("px-3");
    expect(container.firstChild).toHaveClass("py-1");
    expect(container.firstChild).not.toHaveClass("py-2");
    expect(container.firstChild).not.toHaveClass("py-1.5");
  });
});

describe("Row property layout", () => {
  type LayoutProp = "b" | "e" | "a" | "m" | "o" | "g" | "c" | "i";
  type LayoutItem = { id: string };

  const layoutEntity: EntityContract<LayoutItem, LayoutProp> = {
    id: "layout-test",
    label: "Layout test",
    getId: (item) => item.id,
    properties: [
      { id: "b", label: "B", kind: "text", renderCell: () => <span data-testid="cell-b">B</span> },
      { id: "e", label: "E", kind: "text", renderCell: () => <span data-testid="cell-e">E</span> },
      { id: "a", label: "A", kind: "text", isStretch: true, renderCell: () => <span data-testid="cell-a">A</span> },
      { id: "m", label: "M", kind: "text", renderCell: () => <span data-testid="cell-m">M</span> },
      { id: "o", label: "O", kind: "text", renderCell: () => <span data-testid="cell-o">O</span> },
      { id: "g", label: "G", kind: "text", renderCell: () => <span data-testid="cell-g">G</span> },
      { id: "c", label: "C", kind: "text", renderCell: () => <span data-testid="cell-c">C</span> },
      { id: "i", label: "I", kind: "text", renderCell: () => <span data-testid="cell-i">I</span> },
    ],
    defaultProperties: [],
    defaultSort: () => 0,
    Detail: () => null,
    defaultViews: [],
  };

  const layoutItem: LayoutItem = { id: "layout-item" };

  it("renders B E A M O G C I with sides R L L R L R R L as E A O I then B M G C", () => {
    render(
      <Row
        item={layoutItem}
        entity={layoutEntity}
        selectedId={null}
        onSelect={vi.fn()}
        properties={[
          { property: "b", side: "right", visible: true },
          { property: "e", side: "left", visible: true },
          { property: "a", side: "left", visible: true },
          { property: "m", side: "right", visible: true },
          { property: "o", side: "left", visible: true },
          { property: "g", side: "right", visible: true },
          { property: "c", side: "right", visible: true },
          { property: "i", side: "left", visible: true },
        ]}
      />,
    );

    expect(screen.getAllByTestId(/^cell-/).map((node) => node.textContent)).toEqual([
      "E", "A", "O", "I", "B", "M", "G", "C",
    ]);
    // 'a' is the stretch property, so its parent should have flex-1
    expect(screen.getByTestId("cell-a").parentElement).toHaveClass("flex-1");
  });

  it("renders an invisible spacer when the stretch property is on the right", () => {
    const { container } = render(
      <Row
        item={layoutItem}
        entity={layoutEntity}
        selectedId={null}
        onSelect={vi.fn()}
        properties={[
          { property: "e", side: "left", visible: true },
          { property: "a", side: "right", visible: true },
          { property: "b", side: "right", visible: true },
        ]}
      />,
    );

    // The invisible spacer has aria-hidden and flex-1
    expect(container.querySelector("span.flex-1[aria-hidden]")).toBeInTheDocument();
    // 'a' is on the right, so it's NOT the stretch span; it should be flex-none (shrink-0)
    expect(screen.getByTestId("cell-a").parentElement).not.toHaveClass("flex-1");
  });

  it("hidden properties do not appear in the row", () => {
    render(
      <Row
        item={layoutItem}
        entity={layoutEntity}
        selectedId={null}
        onSelect={vi.fn()}
        properties={[
          { property: "e", side: "left", visible: true },
          { property: "a", side: "left", visible: true },
          { property: "b", side: "right", visible: false },
          { property: "m", side: "right", visible: false },
        ]}
      />,
    );

    expect(screen.getByTestId("cell-e")).toBeInTheDocument();
    expect(screen.getByTestId("cell-a")).toBeInTheDocument();
    expect(screen.queryByTestId("cell-b")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cell-m")).not.toBeInTheDocument();
  });

  it("cell wrappers have data-property-id attribute for stable key verification", () => {
    render(
      <Row
        item={layoutItem}
        entity={layoutEntity}
        selectedId={null}
        onSelect={vi.fn()}
        properties={[{ property: "b", side: "left", visible: true }]}
      />,
    );
    expect(screen.getByTestId("cell-b").parentElement).toHaveAttribute("data-property-id", "b");
  });
});
