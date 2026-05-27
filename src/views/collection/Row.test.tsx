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
});
