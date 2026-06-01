import { describe, expect, it } from "vitest";
import { applyQuickSwitcherKey, initialQuickSwitcherKeyboardState } from "./keyboard";

describe("quick switcher keyboard reducer", () => {
  it("starts in input mode with the first result preview-active", () => {
    expect(initialQuickSwitcherKeyboardState(3)).toEqual({ focusMode: "input", activeIndex: 0 });
    expect(initialQuickSwitcherKeyboardState(0)).toEqual({ focusMode: "input", activeIndex: -1 });
  });

  it("moves from input to results on first ArrowDown and lands on the top result", () => {
    const next = applyQuickSwitcherKey({ focusMode: "input", activeIndex: 0 }, { key: "ArrowDown", resultCount: 3 });
    expect(next).toEqual({ state: { focusMode: "results", activeIndex: 0 }, action: "focus-results" });
  });

  it("moves from input to results on ArrowUp when results exist", () => {
    const next = applyQuickSwitcherKey({ focusMode: "input", activeIndex: 0 }, { key: "ArrowUp", resultCount: 3 });
    expect(next).toEqual({ state: { focusMode: "results", activeIndex: 0 }, action: "focus-results" });
  });

  it("treats j and k as result navigation from the input per the spec", () => {
    expect(applyQuickSwitcherKey({ focusMode: "input", activeIndex: 0 }, { key: "j", resultCount: 2 }).state).toEqual({ focusMode: "results", activeIndex: 0 });
    expect(applyQuickSwitcherKey({ focusMode: "input", activeIndex: 0 }, { key: "k", resultCount: 2 }).state).toEqual({ focusMode: "results", activeIndex: 0 });
  });

  it("clamps at the bottom instead of wrapping", () => {
    const next = applyQuickSwitcherKey({ focusMode: "results", activeIndex: 2 }, { key: "ArrowDown", resultCount: 3 });
    expect(next).toEqual({ state: { focusMode: "results", activeIndex: 2 }, action: "move" });
  });

  it("returns to input from the top result on ArrowUp or k", () => {
    expect(applyQuickSwitcherKey({ focusMode: "results", activeIndex: 0 }, { key: "ArrowUp", resultCount: 3 })).toEqual({ state: { focusMode: "input", activeIndex: 0 }, action: "focus-input" });
    expect(applyQuickSwitcherKey({ focusMode: "results", activeIndex: 0 }, { key: "k", resultCount: 3 })).toEqual({ state: { focusMode: "input", activeIndex: 0 }, action: "focus-input" });
  });

  it("opens the active result with Enter when results exist", () => {
    expect(applyQuickSwitcherKey({ focusMode: "input", activeIndex: 0 }, { key: "Enter", resultCount: 1 }).action).toBe("open-result");
    expect(applyQuickSwitcherKey({ focusMode: "results", activeIndex: 0 }, { key: "Enter", resultCount: 1 }).action).toBe("open-result");
  });

  it("ignores Enter when there are no results", () => {
    expect(applyQuickSwitcherKey({ focusMode: "input", activeIndex: -1 }, { key: "Enter", resultCount: 0 }).action).toBe("none");
  });

  it("lets digits type in input mode and activates digits only from results mode", () => {
    expect(applyQuickSwitcherKey({ focusMode: "input", activeIndex: 0 }, { key: "1", resultCount: 1 }).action).toBe("none");
    expect(applyQuickSwitcherKey({ focusMode: "results", activeIndex: 0 }, { key: "1", resultCount: 1 }).action).toBe("open-edge");
    expect(applyQuickSwitcherKey({ focusMode: "results", activeIndex: 0 }, { key: "0", resultCount: 1 }).action).toBe("none");
  });
});
