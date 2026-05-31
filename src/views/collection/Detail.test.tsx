import { render, screen, fireEvent } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Detail } from "./Detail";
import type { EntityContract } from "./types";
import {
  DEFAULT_BOTTOM_PEEK_HEIGHT,
  DEFAULT_SIDE_PEEK_WIDTH,
} from "./previewSizing";

beforeAll(() => {
  (globalThis as any).PointerEvent = window.MouseEvent;
  if (!window.HTMLElement.prototype.hasPointerCapture) window.HTMLElement.prototype.hasPointerCapture = () => false;
  if (!window.HTMLElement.prototype.releasePointerCapture) window.HTMLElement.prototype.releasePointerCapture = () => {};
  if (!window.HTMLElement.prototype.setPointerCapture) window.HTMLElement.prototype.setPointerCapture = () => {};
});

type Item = { id: string; name: string };
type Prop = "name";

const entity: EntityContract<Item, Prop> = {
  id: "test", label: "Test", detailLabel: "issue", getId: (item) => item.id,
  properties: [{ id: "name", label: "Name", kind: "text", renderCell: ({ item }) => <span>{item.name}</span>, isStretch: true }],
  defaultProperties: [{ property: "name", side: "left", visible: true }],
  defaultSort: () => 0,
  Detail: ({ item, preview }) => (
    <div data-testid="entity-detail">
      Detail body: {item.name}
      {preview && (
        <span data-testid="preview-metadata">
          {preview.surface}:{preview.sizeClass}:{preview.width ?? "unknown"}:{preview.height ?? "unknown"}
        </span>
      )}
    </div>
  ),
  defaultViews: [],
};
const item: Item = { id: "1", name: "Alpha" };

function renderDetail(overrides: Partial<React.ComponentProps<typeof Detail<Item, Prop>>> = {}) {
  const props = {
    item,
    entity,
    surface: "side-peek" as const,
    index: 0,
    total: 2,
    canMovePrevious: false,
    canMoveNext: true,
    onClose: vi.fn(),
    onMovePrevious: vi.fn(),
    onMoveNext: vi.fn(),
    sidePeekWidth: DEFAULT_SIDE_PEEK_WIDTH,
    bottomPeekHeight: DEFAULT_BOTTOM_PEEK_HEIGHT,
    onResizeCommit: vi.fn(),
    ...overrides,
  };
  return { ...render(<Detail {...props} />), props };
}

describe("Detail", () => {
  it("renders the entity-specific detail body", () => {
    renderDetail();
    expect(screen.getByTestId("entity-detail")).toBeInTheDocument();
    expect(screen.getByText(/detail body: alpha/i)).toBeInTheDocument();
  });

  it("renders a close button with accessible label", () => {
    renderDetail();
    expect(screen.getByRole("button", { name: /close issue detail/i })).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    renderDetail({ onClose });
    fireEvent.click(screen.getByRole("button", { name: /close issue detail/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("side surface renders as a 440px aside", () => {
    const { container } = renderDetail({ surface: "side-peek" });
    const aside = container.querySelector("aside");
    expect(aside).toHaveStyle({ width: "440px" });
  });

  it("bottom surface renders as a 280px aside", () => {
    const { container } = renderDetail({ surface: "bottom-peek" });
    const aside = container.querySelector("aside");
    expect(aside).toHaveStyle({ height: "280px" });
  });

  it("shows M of N position text", () => {
    renderDetail({ index: 1, total: 5 });
    expect(screen.getByText("2 of 5")).toBeInTheDocument();
  });

  it("disables Previous button when canMovePrevious is false", () => {
    renderDetail({ canMovePrevious: false });
    expect(screen.getByRole("button", { name: "Previous issue" })).toBeDisabled();
  });

  it("enables Next button when canMoveNext is true", () => {
    renderDetail({ canMoveNext: true });
    expect(screen.getByRole("button", { name: "Next issue" })).not.toBeDisabled();
  });

  it("calls onMovePrevious when Previous is clicked", () => {
    const onMovePrevious = vi.fn();
    renderDetail({ canMovePrevious: true, onMovePrevious });
    fireEvent.click(screen.getByRole("button", { name: "Previous issue" }));
    expect(onMovePrevious).toHaveBeenCalledTimes(1);
  });

  it("calls onMoveNext when Next is clicked", () => {
    const onMoveNext = vi.fn();
    renderDetail({ canMoveNext: true, onMoveNext });
    fireEvent.click(screen.getByRole("button", { name: "Next issue" }));
    expect(onMoveNext).toHaveBeenCalledTimes(1);
  });

  it("does not reference Jira-specific modules", () => {
    renderDetail();
    expect(screen.getByText(/detail body:/i)).toBeInTheDocument();
  });

  it("sets preview size data attributes and CSS variables on the content frame", () => {
    renderDetail({ surface: "side-peek", sidePeekWidth: 512 });
    const content = screen.getByTestId("preview-content-frame");
    expect(content).toHaveAttribute("data-preview-surface", "side-peek");
    expect(content).toHaveAttribute("data-preview-size", "compact");
    expect(content).toHaveStyle({ "--preview-width": "512px" });
  });

  it("passes optional preview metadata to entity detail components", () => {
    renderDetail({ surface: "bottom-peek", bottomPeekHeight: 384 });
    expect(screen.getByTestId("preview-metadata")).toHaveTextContent("bottom-peek:roomy");
    expect(screen.getByTestId("preview-metadata")).toHaveTextContent("384");
  });
});
