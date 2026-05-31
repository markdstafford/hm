import { render, screen, fireEvent } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Detail } from "./Detail";
import type { EntityContract } from "./types";
import {
  DEFAULT_BOTTOM_PEEK_HEIGHT,
  DEFAULT_SIDE_PEEK_WIDTH,
  MAX_BOTTOM_PEEK_HEIGHT,
  MAX_SIDE_PEEK_WIDTH,
  MIN_BOTTOM_PEEK_HEIGHT,
  MIN_SIDE_PEEK_WIDTH,
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

  it("side surface renders at the configured default width", () => {
    const { container } = renderDetail({ surface: "side-peek" });
    const aside = container.querySelector("aside");
    expect(aside).toHaveStyle({ width: `${DEFAULT_SIDE_PEEK_WIDTH}px` });
  });

  it("bottom surface renders at the configured default height", () => {
    const { container } = renderDetail({ surface: "bottom-peek" });
    const aside = container.querySelector("aside");
    expect(aside).toHaveStyle({ height: `${DEFAULT_BOTTOM_PEEK_HEIGHT}px` });
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

  it("renders a vertical separator for side resizing", () => {
    renderDetail({ surface: "side-peek" });
    const separator = screen.getByRole("separator", { name: /resize issue detail/i });
    expect(separator).toHaveAttribute("aria-orientation", "vertical");
    expect(separator).toHaveAttribute("aria-valuemin", String(MIN_SIDE_PEEK_WIDTH));
    expect(separator).toHaveAttribute("aria-valuemax", String(MAX_SIDE_PEEK_WIDTH));
    expect(separator).toHaveAttribute("aria-valuenow", String(DEFAULT_SIDE_PEEK_WIDTH));
  });

  it("renders a horizontal separator for bottom resizing", () => {
    renderDetail({ surface: "bottom-peek" });
    const separator = screen.getByRole("separator", { name: /resize issue detail/i });
    expect(separator).toHaveAttribute("aria-orientation", "horizontal");
    expect(separator).toHaveAttribute("aria-valuemin", String(MIN_BOTTOM_PEEK_HEIGHT));
    expect(separator).toHaveAttribute("aria-valuemax", String(MAX_BOTTOM_PEEK_HEIGHT));
    expect(separator).toHaveAttribute("aria-valuenow", String(DEFAULT_BOTTOM_PEEK_HEIGHT));
  });

  it("dragging the side splitter left increases width and commits the clamped size", () => {
    const onResizeCommit = vi.fn();
    const { container } = renderDetail({ surface: "side-peek", onResizeCommit });
    const separator = screen.getByRole("separator", { name: /resize issue detail/i });
    const aside = container.querySelector("aside");
    fireEvent.pointerDown(separator, { pointerId: 1, clientX: 500 });
    fireEvent.pointerMove(separator, { pointerId: 1, clientX: 420 });
    expect(aside).toHaveStyle({ width: "520px" });
    fireEvent.pointerUp(separator, { pointerId: 1, clientX: 420 });
    expect(onResizeCommit).toHaveBeenCalledWith("side-peek", 520);
  });

  it("dragging the side splitter clamps at minimum and maximum", () => {
    const onResizeCommit = vi.fn();
    const { container } = renderDetail({ surface: "side-peek", onResizeCommit });
    const separator = screen.getByRole("separator", { name: /resize issue detail/i });
    const aside = container.querySelector("aside");
    fireEvent.pointerDown(separator, { pointerId: 1, clientX: 500 });
    fireEvent.pointerMove(separator, { pointerId: 1, clientX: 900 });
    expect(aside).toHaveStyle({ width: `${MIN_SIDE_PEEK_WIDTH}px` });
    fireEvent.pointerUp(separator, { pointerId: 1, clientX: 900 });
    expect(onResizeCommit).toHaveBeenLastCalledWith("side-peek", MIN_SIDE_PEEK_WIDTH);
    fireEvent.pointerDown(separator, { pointerId: 2, clientX: 500 });
    fireEvent.pointerMove(separator, { pointerId: 2, clientX: -500 });
    expect(aside).toHaveStyle({ width: `${MAX_SIDE_PEEK_WIDTH}px` });
    fireEvent.pointerUp(separator, { pointerId: 2, clientX: -500 });
    expect(onResizeCommit).toHaveBeenLastCalledWith("side-peek", MAX_SIDE_PEEK_WIDTH);
  });

  it("dragging the bottom splitter up increases height and commits the clamped size", () => {
    const onResizeCommit = vi.fn();
    const { container } = renderDetail({ surface: "bottom-peek", onResizeCommit });
    const separator = screen.getByRole("separator", { name: /resize issue detail/i });
    const aside = container.querySelector("aside");
    fireEvent.pointerDown(separator, { pointerId: 1, clientY: 700 });
    fireEvent.pointerMove(separator, { pointerId: 1, clientY: 620 });
    expect(aside).toHaveStyle({ height: "360px" });
    fireEvent.pointerUp(separator, { pointerId: 1, clientY: 620 });
    expect(onResizeCommit).toHaveBeenCalledWith("bottom-peek", 360);
  });

  it("dragging the bottom splitter clamps at minimum and maximum", () => {
    const onResizeCommit = vi.fn();
    const { container } = renderDetail({ surface: "bottom-peek", onResizeCommit });
    const separator = screen.getByRole("separator", { name: /resize issue detail/i });
    const aside = container.querySelector("aside");
    fireEvent.pointerDown(separator, { pointerId: 1, clientY: 700 });
    fireEvent.pointerMove(separator, { pointerId: 1, clientY: 900 });
    expect(aside).toHaveStyle({ height: `${MIN_BOTTOM_PEEK_HEIGHT}px` });
    fireEvent.pointerUp(separator, { pointerId: 1, clientY: 900 });
    expect(onResizeCommit).toHaveBeenLastCalledWith("bottom-peek", MIN_BOTTOM_PEEK_HEIGHT);
    fireEvent.pointerDown(separator, { pointerId: 2, clientY: 700 });
    fireEvent.pointerMove(separator, { pointerId: 2, clientY: 0 });
    expect(aside).toHaveStyle({ height: `${MAX_BOTTOM_PEEK_HEIGHT}px` });
    fireEvent.pointerUp(separator, { pointerId: 2, clientY: 0 });
    expect(onResizeCommit).toHaveBeenLastCalledWith("bottom-peek", MAX_BOTTOM_PEEK_HEIGHT);
  });

  it("ArrowLeft and ArrowRight resize the side separator", () => {
    const onResizeCommit = vi.fn();
    const { container } = renderDetail({ surface: "side-peek", onResizeCommit });
    const separator = screen.getByRole("separator", { name: /resize issue detail/i });
    const aside = container.querySelector("aside");
    fireEvent.keyDown(separator, { key: "ArrowLeft" });
    expect(aside).toHaveStyle({ width: "456px" });
    expect(onResizeCommit).toHaveBeenLastCalledWith("side-peek", 456);
    fireEvent.keyDown(separator, { key: "ArrowRight", shiftKey: true });
    expect(aside).toHaveStyle({ width: "392px" });
    expect(onResizeCommit).toHaveBeenLastCalledWith("side-peek", 392);
  });

  it("ArrowUp and ArrowDown resize the bottom separator", () => {
    const onResizeCommit = vi.fn();
    const { container } = renderDetail({ surface: "bottom-peek", onResizeCommit });
    const separator = screen.getByRole("separator", { name: /resize issue detail/i });
    const aside = container.querySelector("aside");
    fireEvent.keyDown(separator, { key: "ArrowUp" });
    expect(aside).toHaveStyle({ height: "296px" });
    expect(onResizeCommit).toHaveBeenLastCalledWith("bottom-peek", 296);
    fireEvent.keyDown(separator, { key: "ArrowDown", shiftKey: true });
    expect(aside).toHaveStyle({ height: "232px" });
    expect(onResizeCommit).toHaveBeenLastCalledWith("bottom-peek", 232);
  });

  it("renders a focus breadcrumb between host chrome and side detail content", () => {
    const onPickFocusCrumb = vi.fn();
    renderDetail({
      focusTrail: [
        { item, label: "AMP-1087" },
        { item: { id: "2", name: "Beta" }, label: "AMP-1102" },
      ],
      onPickFocusCrumb,
    });
    expect(screen.getByRole("navigation", { name: "Preview focus path" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Return to AMP-1087" }));
    expect(onPickFocusCrumb).toHaveBeenCalledWith(0);
  });

  it("renders a focus breadcrumb in bottom peek previews", () => {
    renderDetail({
      surface: "bottom-peek",
      focusTrail: [
        { item, label: "AMP-1087" },
        { item: { id: "2", name: "Beta" }, label: "AMP-1102" },
      ],
    });
    expect(screen.getByRole("navigation", { name: "Preview focus path" })).toBeInTheDocument();
  });
});
