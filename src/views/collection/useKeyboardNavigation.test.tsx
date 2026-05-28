import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useKeyboardNavigation } from "./useKeyboardNavigation";

function HarnessWithSelect({
  onMoveNext,
  onMovePrevious,
}: { onMoveNext: () => void; onMovePrevious: () => void }) {
  useKeyboardNavigation({
    enabled: true,
    selectedIndex: 1,
    total: 5,
    previewOpen: false,
    onSelectFirst: vi.fn(),
    onSelectLast: vi.fn(),
    onMovePrevious,
    onMoveNext,
    onOpenPreview: vi.fn(),
    onClosePreview: vi.fn(),
  });
  return <select data-testid="select-input"><option>A</option></select>;
}

function Harness({
  enabled = true,
  selectedIndex = 1,
  total = 5,
  previewOpen = false,
  onSelectFirst = vi.fn(),
  onSelectLast = vi.fn(),
  onMovePrevious = vi.fn(),
  onMoveNext = vi.fn(),
  onOpenPreview = vi.fn(),
  onClosePreview = vi.fn(),
  onToggleSelection,
}: Partial<Parameters<typeof useKeyboardNavigation>[0]>) {
  useKeyboardNavigation({
    enabled,
    selectedIndex,
    total,
    previewOpen,
    onSelectFirst,
    onSelectLast,
    onMovePrevious,
    onMoveNext,
    onOpenPreview,
    onClosePreview,
    onToggleSelection,
  });
  return (
    <div>
      <input data-testid="text-input" />
      <textarea data-testid="textarea-input" />
      <div data-testid="content-editable" contentEditable suppressContentEditableWarning>editable</div>
      <button type="button" data-testid="row-body-button">Row body</button>
      <button type="button" role="checkbox" data-testid="row-checkbox" aria-checked="false">Select item</button>
    </div>
  );
}

describe("useKeyboardNavigation", () => {
  // ── ArrowDown / j ────────────────────────────────────────────────────
  it("ArrowDown moves next when canMoveNext", () => {
    const onMoveNext = vi.fn();
    render(<Harness selectedIndex={1} total={5} onMoveNext={onMoveNext} />);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(onMoveNext).toHaveBeenCalledTimes(1);
  });

  it("j moves next regardless of preview state", () => {
    const onMoveNext = vi.fn();
    render(<Harness selectedIndex={1} total={5} previewOpen={false} onMoveNext={onMoveNext} />);
    fireEvent.keyDown(window, { key: "j" });
    expect(onMoveNext).toHaveBeenCalledTimes(1);
  });

  it("j moves next even when preview is open", () => {
    const onMoveNext = vi.fn();
    render(<Harness selectedIndex={1} total={5} previewOpen={true} onMoveNext={onMoveNext} />);
    fireEvent.keyDown(window, { key: "j" });
    expect(onMoveNext).toHaveBeenCalledTimes(1);
  });

  it("ArrowDown does nothing at the last item", () => {
    const onMoveNext = vi.fn();
    render(<Harness selectedIndex={4} total={5} onMoveNext={onMoveNext} />);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(onMoveNext).not.toHaveBeenCalled();
  });

  it("ArrowDown selects first when nothing is selected", () => {
    const onSelectFirst = vi.fn();
    render(<Harness selectedIndex={-1} total={5} onSelectFirst={onSelectFirst} />);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(onSelectFirst).toHaveBeenCalledTimes(1);
  });

  it("j selects first when nothing is selected", () => {
    const onSelectFirst = vi.fn();
    render(<Harness selectedIndex={-1} total={5} onSelectFirst={onSelectFirst} />);
    fireEvent.keyDown(window, { key: "j" });
    expect(onSelectFirst).toHaveBeenCalledTimes(1);
  });

  // ── ArrowUp / k ──────────────────────────────────────────────────────
  it("ArrowUp moves previous when canMovePrevious", () => {
    const onMovePrevious = vi.fn();
    render(<Harness selectedIndex={2} onMovePrevious={onMovePrevious} />);
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(onMovePrevious).toHaveBeenCalledTimes(1);
  });

  it("k moves previous regardless of preview state", () => {
    const onMovePrevious = vi.fn();
    render(<Harness selectedIndex={2} previewOpen={false} onMovePrevious={onMovePrevious} />);
    fireEvent.keyDown(window, { key: "k" });
    expect(onMovePrevious).toHaveBeenCalledTimes(1);
  });

  it("k moves previous even when preview is open", () => {
    const onMovePrevious = vi.fn();
    render(<Harness selectedIndex={2} previewOpen={true} onMovePrevious={onMovePrevious} />);
    fireEvent.keyDown(window, { key: "k" });
    expect(onMovePrevious).toHaveBeenCalledTimes(1);
  });

  it("ArrowUp does nothing at the first item", () => {
    const onMovePrevious = vi.fn();
    render(<Harness selectedIndex={0} onMovePrevious={onMovePrevious} />);
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(onMovePrevious).not.toHaveBeenCalled();
  });

  it("ArrowUp selects last when nothing is selected", () => {
    const onSelectLast = vi.fn();
    render(<Harness selectedIndex={-1} total={5} onSelectLast={onSelectLast} />);
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(onSelectLast).toHaveBeenCalledTimes(1);
  });

  it("k selects last when nothing is selected", () => {
    const onSelectLast = vi.fn();
    render(<Harness selectedIndex={-1} total={5} onSelectLast={onSelectLast} />);
    fireEvent.keyDown(window, { key: "k" });
    expect(onSelectLast).toHaveBeenCalledTimes(1);
  });

  // ── Enter ────────────────────────────────────────────────────────────
  it("Enter opens preview when row selected and preview closed", () => {
    const onOpenPreview = vi.fn();
    render(<Harness selectedIndex={1} previewOpen={false} onOpenPreview={onOpenPreview} />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onOpenPreview).toHaveBeenCalledTimes(1);
  });

  it("Enter is a no-op when preview is already open", () => {
    const onOpenPreview = vi.fn();
    render(<Harness selectedIndex={1} previewOpen={true} onOpenPreview={onOpenPreview} />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onOpenPreview).not.toHaveBeenCalled();
  });

  it("Enter is a no-op when no row is selected", () => {
    const onOpenPreview = vi.fn();
    render(<Harness selectedIndex={-1} previewOpen={false} onOpenPreview={onOpenPreview} />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onOpenPreview).not.toHaveBeenCalled();
  });

  // ── Escape ───────────────────────────────────────────────────────────
  it("Escape closes preview when open (any preview mode)", () => {
    const onClosePreview = vi.fn();
    render(<Harness previewOpen={true} onClosePreview={onClosePreview} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClosePreview).toHaveBeenCalledTimes(1);
  });

  it("Escape is a no-op when preview is closed", () => {
    const onClosePreview = vi.fn();
    render(<Harness previewOpen={false} onClosePreview={onClosePreview} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClosePreview).not.toHaveBeenCalled();
  });

  // ── Space ────────────────────────────────────────────────────────────
  it("Space calls onToggleSelection when a row is selected", () => {
    const onToggleSelection = vi.fn();
    render(<Harness selectedIndex={1} onToggleSelection={onToggleSelection} />);
    fireEvent.keyDown(window, { key: " " });
    expect(onToggleSelection).toHaveBeenCalledTimes(1);
  });

  it("Space is a no-op when no row is selected", () => {
    const onToggleSelection = vi.fn();
    render(<Harness selectedIndex={-1} onToggleSelection={onToggleSelection} />);
    fireEvent.keyDown(window, { key: " " });
    expect(onToggleSelection).not.toHaveBeenCalled();
  });

  it("Space is a no-op when onToggleSelection is not provided", () => {
    render(<Harness selectedIndex={1} />);
    // Should not throw; default scrolling prevention is irrelevant in test env
    fireEvent.keyDown(window, { key: " " });
  });

  it("Space is suppressed in form fields", () => {
    const onToggleSelection = vi.fn();
    render(<Harness selectedIndex={1} onToggleSelection={onToggleSelection} />);
    const input = screen.getByTestId("text-input");
    fireEvent.keyDown(input, { key: " " });
    expect(onToggleSelection).not.toHaveBeenCalled();
  });

  it("Space does not call onToggleSelection when focus is on a row body button", () => {
    const onToggleSelection = vi.fn();
    render(<Harness selectedIndex={1} onToggleSelection={onToggleSelection} />);
    const rowBody = screen.getByTestId("row-body-button");
    fireEvent.keyDown(rowBody, { key: " " });
    expect(onToggleSelection).not.toHaveBeenCalled();
  });

  it("Space does not call onToggleSelection when focus is on a row checkbox button", () => {
    const onToggleSelection = vi.fn();
    render(<Harness selectedIndex={1} onToggleSelection={onToggleSelection} />);
    const checkbox = screen.getByTestId("row-checkbox");
    fireEvent.keyDown(checkbox, { key: " " });
    expect(onToggleSelection).not.toHaveBeenCalled();
  });

  // ── Enabled gate ─────────────────────────────────────────────────────
  it("does nothing when disabled", () => {
    const onMoveNext = vi.fn();
    const onClosePreview = vi.fn();
    render(<Harness enabled={false} previewOpen={true} onMoveNext={onMoveNext} onClosePreview={onClosePreview} />);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onMoveNext).not.toHaveBeenCalled();
    expect(onClosePreview).not.toHaveBeenCalled();
  });

  // ── Form field suppression ───────────────────────────────────────────
  it("ignores ArrowDown when target is an input", () => {
    const onMoveNext = vi.fn();
    render(<Harness onMoveNext={onMoveNext} />);
    const input = screen.getByTestId("text-input");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(onMoveNext).not.toHaveBeenCalled();
  });

  it("ignores ArrowDown when target is a textarea", () => {
    const onMoveNext = vi.fn();
    render(<Harness onMoveNext={onMoveNext} />);
    const textarea = screen.getByTestId("textarea-input");
    fireEvent.keyDown(textarea, { key: "ArrowDown" });
    expect(onMoveNext).not.toHaveBeenCalled();
  });

  it("ignores ArrowDown when target is contentEditable", () => {
    const onMoveNext = vi.fn();
    render(<Harness onMoveNext={onMoveNext} />);
    const ce = screen.getByTestId("content-editable");
    fireEvent.keyDown(ce, { key: "ArrowDown" });
    expect(onMoveNext).not.toHaveBeenCalled();
  });

  it("ignores ArrowDown when target is a select element", () => {
    const onMoveNext = vi.fn() as () => void;
    render(<HarnessWithSelect onMoveNext={onMoveNext} onMovePrevious={vi.fn() as () => void} />);
    const sel = screen.getByTestId("select-input");
    fireEvent.keyDown(sel, { key: "ArrowDown" });
    expect(onMoveNext).not.toHaveBeenCalled();
  });
});
