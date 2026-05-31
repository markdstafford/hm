import { describe, expect, it } from "vitest";
import {
  appendFocusTarget,
  currentFocusItem,
  initializeFocusTrail,
  resetFocusTrail,
  truncateFocusTrail,
} from "./focusTrail";

type Item = { id: string; key?: string; title?: string | null };

const getId = (item: Item) => item.id;
const getLabel = (item: Item) => item.key ?? item.title ?? item.id;

const alpha: Item = { id: "1", key: "AMP-1087", title: "Start" };
const beta: Item = { id: "2", key: "AMP-1102", title: "Duplicate" };

function labels(trail: ReturnType<typeof initializeFocusTrail<Item>>) {
  return trail.map((entry) => entry.label);
}

describe("focusTrail", () => {
  it("initializes from the selected item", () => {
    expect(initializeFocusTrail(alpha, getLabel)).toEqual([
      { item: alpha, label: "AMP-1087" },
    ]);
  });

  it("falls back to the entity id when the label resolver returns blank text", () => {
    const trail = initializeFocusTrail({ id: "fallback", title: "" }, () => "   ", getId);
    expect(trail).toEqual([{ item: { id: "fallback", title: "" }, label: "fallback" }]);
  });

  it("appends targets and allows graph loops", () => {
    const one = initializeFocusTrail(alpha, getLabel, getId);
    const two = appendFocusTarget(one, beta, getLabel, getId);
    const three = appendFocusTarget(two, alpha, getLabel, getId);
    expect(labels(three)).toEqual(["AMP-1087", "AMP-1102", "AMP-1087"]);
    expect(currentFocusItem(three)).toBe(alpha);
  });

  it("truncates to the selected crumb index", () => {
    const trail = appendFocusTarget(
      appendFocusTarget(initializeFocusTrail(alpha, getLabel, getId), beta, getLabel, getId),
      { id: "3", key: "PR #190" },
      getLabel,
      getId,
    );
    expect(labels(truncateFocusTrail(trail, 1))).toEqual(["AMP-1087", "AMP-1102"]);
  });

  it("does not truncate for out-of-range crumb indexes", () => {
    const trail = appendFocusTarget(initializeFocusTrail(alpha, getLabel, getId), beta, getLabel, getId);
    expect(truncateFocusTrail(trail, -1)).toBe(trail);
    expect(truncateFocusTrail(trail, 7)).toBe(trail);
  });

  it("resets to a newly selected row", () => {
    const trail = appendFocusTarget(initializeFocusTrail(alpha, getLabel, getId), beta, getLabel, getId);
    expect(resetFocusTrail(trail, beta, getLabel, getId)).toEqual([
      { item: beta, label: "AMP-1102" },
    ]);
  });
});
