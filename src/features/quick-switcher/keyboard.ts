export type QuickSwitcherFocusMode = "input" | "results";

export type QuickSwitcherKeyboardState = {
  focusMode: QuickSwitcherFocusMode;
  activeIndex: number;
};

export type QuickSwitcherKeyboardAction =
  | "none"
  | "focus-input"
  | "focus-results"
  | "move"
  | "open-result"
  | "open-edge";

export type QuickSwitcherKeyboardEvent = {
  key: string;
  resultCount: number;
};

export function initialQuickSwitcherKeyboardState(resultCount: number): QuickSwitcherKeyboardState {
  return { focusMode: "input", activeIndex: resultCount > 0 ? 0 : -1 };
}

function hasResults(resultCount: number): boolean {
  return resultCount > 0;
}

function clampIndex(index: number, resultCount: number): number {
  if (resultCount <= 0) return -1;
  return Math.min(Math.max(index, 0), resultCount - 1);
}

function isNextKey(key: string): boolean {
  return key === "ArrowDown" || key === "j";
}

function isPreviousKey(key: string): boolean {
  return key === "ArrowUp" || key === "k";
}

function isDigitShortcut(key: string): boolean {
  return /^[1-9]$/.test(key);
}

export function applyQuickSwitcherKey(
  state: QuickSwitcherKeyboardState,
  event: QuickSwitcherKeyboardEvent,
): { state: QuickSwitcherKeyboardState; action: QuickSwitcherKeyboardAction } {
  const { key, resultCount } = event;
  const activeIndex = clampIndex(state.activeIndex, resultCount);

  if (!hasResults(resultCount)) {
    return { state: { focusMode: "input", activeIndex: -1 }, action: "none" };
  }

  if (key === "Enter") {
    return { state: { ...state, activeIndex }, action: "open-result" };
  }

  if (state.focusMode === "input" && (isNextKey(key) || isPreviousKey(key))) {
    return { state: { focusMode: "results", activeIndex: 0 }, action: "focus-results" };
  }

  if (state.focusMode === "results" && isNextKey(key)) {
    return {
      state: { focusMode: "results", activeIndex: clampIndex(activeIndex + 1, resultCount) },
      action: "move",
    };
  }

  if (state.focusMode === "results" && isPreviousKey(key)) {
    if (activeIndex <= 0) {
      return { state: { focusMode: "input", activeIndex: 0 }, action: "focus-input" };
    }
    return { state: { focusMode: "results", activeIndex: activeIndex - 1 }, action: "move" };
  }

  if (state.focusMode === "results" && isDigitShortcut(key)) {
    return { state: { focusMode: "results", activeIndex }, action: "open-edge" };
  }

  return { state: { ...state, activeIndex }, action: "none" };
}
