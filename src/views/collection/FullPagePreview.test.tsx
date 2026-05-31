import { render, screen, fireEvent } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { axe } from "jest-axe";
import { FullPagePreview } from "./FullPagePreview";
import type { EntityContract } from "./types";

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
      {item.name}
      {preview && (
        <span data-testid="full-page-preview-metadata">
          {preview.surface}:{preview.sizeClass}:{preview.width ?? "unknown"}:{preview.height ?? "unknown"}
        </span>
      )}
    </div>
  ),
  defaultViews: [],
};

const item: Item = { id: "1", name: "Alpha" };

function renderFull(overrides: Partial<React.ComponentProps<typeof FullPagePreview<Item, Prop>>> = {}) {
  const props = {
    item,
    entity,
    index: 1,
    total: 3,
    canMovePrevious: true,
    canMoveNext: true,
    onBack: vi.fn(),
    onMovePrevious: vi.fn(),
    onMoveNext: vi.fn(),
    ...overrides,
  };
  return { ...render(<FullPagePreview {...props} />), props };
}

describe("FullPagePreview", () => {
  it("renders Back to list (Esc) button", () => {
    renderFull();
    expect(screen.getByRole("button", { name: "Back to list (Esc)" })).toBeInTheDocument();
  });

  it("shows M of N position", () => {
    renderFull({ index: 1, total: 3 });
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
  });

  it("renders Previous and Next issue buttons", () => {
    renderFull();
    expect(screen.getByRole("button", { name: "Previous issue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next issue" })).toBeInTheDocument();
  });

  it("disables Previous at index 0", () => {
    renderFull({ index: 0, canMovePrevious: false });
    expect(screen.getByRole("button", { name: "Previous issue" })).toBeDisabled();
  });

  it("disables Next at last item", () => {
    renderFull({ index: 2, total: 3, canMoveNext: false });
    expect(screen.getByRole("button", { name: "Next issue" })).toBeDisabled();
  });

  it("shows keyboard navigation hint (j / k)", () => {
    renderFull();
    expect(screen.getByLabelText("Keyboard navigation hint")).toBeInTheDocument();
  });

  it("renders the entity detail body", () => {
    renderFull();
    expect(screen.getByTestId("entity-detail")).toHaveTextContent("Alpha");
  });

  it("calls onBack when back button is clicked", () => {
    const onBack = vi.fn();
    renderFull({ onBack });
    fireEvent.click(screen.getByRole("button", { name: "Back to list (Esc)" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("calls onMovePrevious when Previous is clicked", () => {
    const onMovePrevious = vi.fn();
    renderFull({ onMovePrevious });
    fireEvent.click(screen.getByRole("button", { name: "Previous issue" }));
    expect(onMovePrevious).toHaveBeenCalledTimes(1);
  });

  it("calls onMoveNext when Next is clicked", () => {
    const onMoveNext = vi.fn();
    renderFull({ onMoveNext });
    fireEvent.click(screen.getByRole("button", { name: "Next issue" }));
    expect(onMoveNext).toHaveBeenCalledTimes(1);
  });

  it("passes roomy full-page preview metadata to the entity detail", () => {
    renderFull();
    expect(screen.getByTestId("full-page-preview-metadata")).toHaveTextContent(
      "full-page:roomy:unknown:unknown",
    );
  });

  it("has no axe violations", async () => {
    const { container } = renderFull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders a focus breadcrumb below full-page chrome", () => {
    renderFull({
      focusTrail: [
        { item, label: "AMP-1087" },
        { item: { id: "2", name: "Beta" }, label: "AMP-1102" },
      ],
    });
    expect(screen.getByRole("navigation", { name: "Preview focus path" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to list (Esc)" })).toBeInTheDocument();
  });

  it("calls onPickFocusCrumb from full-page breadcrumbs", () => {
    const onPickFocusCrumb = vi.fn();
    renderFull({
      onPickFocusCrumb,
      focusTrail: [
        { item, label: "AMP-1087" },
        { item: { id: "2", name: "Beta" }, label: "AMP-1102" },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Return to AMP-1087" }));
    expect(onPickFocusCrumb).toHaveBeenCalledWith(0);
  });

  it("has no axe violations with a focus breadcrumb", async () => {
    const { container } = renderFull({
      focusTrail: [
        { item, label: "AMP-1087" },
        { item: { id: "2", name: "Beta" }, label: "AMP-1102" },
      ],
    });
    expect(await axe(container)).toHaveNoViolations();
  });
});
