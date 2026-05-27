import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useKeyboardNavigation } from "./useKeyboardNavigation";

// Renders a <select> alongside the hook harness for filter testing
function HarnessWithSelect({
  onMoveNext,
  onMovePrevious,
}: { onMoveNext: () => void; onMovePrevious: () => void }) {
  useKeyboardNavigation({
    enabled: true,
    previewOpen: false,
    selectedIndex: 1,
    total: 5,
    onMovePrevious,
    onMoveNext,
    onOpenPreview: vi.fn(),
    onClosePreview: vi.fn(),
  });
  return <select data-testid="select-input"><option>A</option></select>;
}

// Minimal harness component
function Harness({
  enabled = true,
  previewOpen = false,
  selectedIndex = 1,
  total = 5,
  onMovePrevious = vi.fn(),
  onMoveNext = vi.fn(),
  onOpenPreview = vi.fn(),
  onClosePreview = vi.fn(),
}: Partial<Parameters<typeof useKeyboardNavigation>[0]>) {
  useKeyboardNavigation({ enabled, previewOpen, selectedIndex, total, onMovePrevious, onMoveNext, onOpenPreview, onClosePreview });
  return (
    <div>
      <input data-testid="text-input" />
      <textarea data-testid="textarea-input" />
      <div data-testid="content-editable" contentEditable suppressContentEditableWarning>editable</div>
    </div>
  );
}

describe("useKeyboardNavigation", () => {
  it("ArrowUp calls onMovePrevious when canMovePrevious (index > 0)", () => {
    const onMovePrevious = vi.fn();
    render(<Harness selectedIndex={2} onMovePrevious={onMovePrevious} />);
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(onMovePrevious).toHaveBeenCalledTimes(1);
  });

  it("ArrowDown calls onMoveNext when canMoveNext (index < total-1)", () => {
    const onMoveNext = vi.fn();
    render(<Harness selectedIndex={1} total={5} onMoveNext={onMoveNext} />);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(onMoveNext).toHaveBeenCalledTimes(1);
  });

  it("ArrowUp does nothing when at first item (index 0)", () => {
    const onMovePrevious = vi.fn();
    render(<Harness selectedIndex={0} onMovePrevious={onMovePrevious} />);
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(onMovePrevious).not.toHaveBeenCalled();
  });

  it("ArrowDown does nothing when at last item (index === total-1)", () => {
    const onMoveNext = vi.fn();
    render(<Harness selectedIndex={4} total={5} onMoveNext={onMoveNext} />);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(onMoveNext).not.toHaveBeenCalled();
  });

  it("does nothing when disabled", () => {
    const onMoveNext = vi.fn();
    render(<Harness enabled={false} onMoveNext={onMoveNext} />);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(onMoveNext).not.toHaveBeenCalled();
  });

  it("does nothing when selectedIndex is negative (no selection)", () => {
    const onMovePrevious = vi.fn();
    render(<Harness selectedIndex={-1} onMovePrevious={onMovePrevious} />);
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(onMovePrevious).not.toHaveBeenCalled();
  });

  it("j calls onMoveNext in any mode", () => {
    const onMoveNext = vi.fn();
    render(<Harness onMoveNext={onMoveNext} />);
    fireEvent.keyDown(window, { key: "j" });
    expect(onMoveNext).toHaveBeenCalledTimes(1);
  });

  it("k calls onMovePrevious in any mode", () => {
    const onMovePrevious = vi.fn();
    render(<Harness selectedIndex={2} onMovePrevious={onMovePrevious} />);
    fireEvent.keyDown(window, { key: "k" });
    expect(onMovePrevious).toHaveBeenCalledTimes(1);
  });

  it("Escape calls onClosePreview when previewOpen is true", () => {
    const onClosePreview = vi.fn();
    render(<Harness previewOpen={true} onClosePreview={onClosePreview} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClosePreview).toHaveBeenCalledTimes(1);
  });

  it("Escape does NOT call onClosePreview when previewOpen is false", () => {
    const onClosePreview = vi.fn();
    render(<Harness previewOpen={false} onClosePreview={onClosePreview} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClosePreview).not.toHaveBeenCalled();
  });

  it("Enter calls onOpenPreview when previewOpen is false", () => {
    const onOpenPreview = vi.fn();
    render(<Harness previewOpen={false} onOpenPreview={onOpenPreview} />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onOpenPreview).toHaveBeenCalledTimes(1);
  });

  it("Enter does NOT call onOpenPreview when previewOpen is true", () => {
    const onOpenPreview = vi.fn();
    render(<Harness previewOpen={true} onOpenPreview={onOpenPreview} />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onOpenPreview).not.toHaveBeenCalled();
  });

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
