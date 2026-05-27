import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useKeyboardNavigation } from "./useKeyboardNavigation";
import type { PreviewSurface } from "./ViewConfig";

// Renders a <select> alongside the hook harness for filter testing
function HarnessWithSelect({
  onMoveNext,
  onMovePrevious,
}: { onMoveNext: () => void; onMovePrevious: () => void }) {
  useKeyboardNavigation({
    enabled: true,
    mode: "side-peek",
    selectedIndex: 1,
    total: 5,
    onMovePrevious,
    onMoveNext,
    onExitFullPage: vi.fn(),
  });
  return <select data-testid="select-input"><option>A</option></select>;
}

// Minimal harness component
function Harness({
  enabled = true,
  mode = "side-peek" as PreviewSurface,
  selectedIndex = 1,
  total = 5,
  onMovePrevious = vi.fn(),
  onMoveNext = vi.fn(),
  onExitFullPage = vi.fn(),
}: Partial<Parameters<typeof useKeyboardNavigation>[0]>) {
  useKeyboardNavigation({ enabled, mode, selectedIndex, total, onMovePrevious, onMoveNext, onExitFullPage });
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

  it("j calls onMoveNext in full-page mode", () => {
    const onMoveNext = vi.fn();
    render(<Harness mode="full-page" onMoveNext={onMoveNext} />);
    fireEvent.keyDown(window, { key: "j" });
    expect(onMoveNext).toHaveBeenCalledTimes(1);
  });

  it("k calls onMovePrevious in full-page mode", () => {
    const onMovePrevious = vi.fn();
    render(<Harness mode="full-page" selectedIndex={2} onMovePrevious={onMovePrevious} />);
    fireEvent.keyDown(window, { key: "k" });
    expect(onMovePrevious).toHaveBeenCalledTimes(1);
  });

  it("j does NOT call onMoveNext in side-peek mode", () => {
    const onMoveNext = vi.fn();
    render(<Harness mode="side-peek" onMoveNext={onMoveNext} />);
    fireEvent.keyDown(window, { key: "j" });
    expect(onMoveNext).not.toHaveBeenCalled();
  });

  it("k does NOT call onMovePrevious in bottom-peek mode", () => {
    const onMovePrevious = vi.fn();
    render(<Harness mode="bottom-peek" selectedIndex={2} onMovePrevious={onMovePrevious} />);
    fireEvent.keyDown(window, { key: "k" });
    expect(onMovePrevious).not.toHaveBeenCalled();
  });

  it("Escape calls onExitFullPage only in full-page mode", () => {
    const onExitFullPage = vi.fn();
    render(<Harness mode="full-page" onExitFullPage={onExitFullPage} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onExitFullPage).toHaveBeenCalledTimes(1);
  });

  it("Escape does NOT call onExitFullPage in side-peek mode", () => {
    const onExitFullPage = vi.fn();
    render(<Harness mode="side-peek" onExitFullPage={onExitFullPage} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onExitFullPage).not.toHaveBeenCalled();
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
