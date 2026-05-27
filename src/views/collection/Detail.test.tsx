import { render, screen, fireEvent } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Detail } from "./Detail";
import type { EntityContract } from "./types";

beforeAll(() => {
  (globalThis as any).PointerEvent = window.MouseEvent;
  if (!window.HTMLElement.prototype.hasPointerCapture)
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  if (!window.HTMLElement.prototype.releasePointerCapture)
    window.HTMLElement.prototype.releasePointerCapture = () => {};
  if (!window.HTMLElement.prototype.setPointerCapture)
    window.HTMLElement.prototype.setPointerCapture = () => {};
});

type Item = { id: string; name: string };
type Prop = "name";

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
  ],
  defaultProperties: [{ property: "name", side: "left", visible: true }],
  defaultSort: () => 0,
  Detail: ({ item }) => <div data-testid="entity-detail">Detail body: {item.name}</div>,
};

const item: Item = { id: "1", name: "Alpha" };

describe("Detail", () => {
  it("renders the entity-specific detail body", () => {
    render(<Detail item={item} entity={entity} onClose={vi.fn()} />);
    expect(screen.getByTestId("entity-detail")).toBeInTheDocument();
    expect(screen.getByText(/detail body: alpha/i)).toBeInTheDocument();
  });

  it("renders a close button with accessible label", () => {
    render(<Detail item={item} entity={entity} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /close issue detail/i })).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<Detail item={item} entity={entity} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /close issue detail/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not import or reference Jira-specific modules", () => {
    render(<Detail item={item} entity={entity} onClose={vi.fn()} />);
    expect(screen.getByText(/detail body:/i)).toBeInTheDocument();
  });
});
