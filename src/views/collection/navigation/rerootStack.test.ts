import { describe, expect, it } from "vitest";
import { createBaseRoot, pushScopedRoot, returnToPreviousRoot } from "./rerootStack";

type Item = { id: string; key: string };

const getId = (item: Item) => item.id;
const alpha: Item = { id: "a", key: "AMP-1087" };
const beta: Item = { id: "b", key: "AMP-1102" };
const gamma: Item = { id: "c", key: "AMP-800" };

describe("rerootStack", () => {
  it("creates a base root from collection items", () => {
    expect(createBaseRoot([alpha, beta], "b", true)).toEqual({
      id: "base",
      label: "All items",
      items: [alpha, beta],
      selectedId: "b",
      previewOpen: true,
      base: true,
    });
  });

  it("pushes a scoped root while preserving the previous root on the stack", () => {
    const base = createBaseRoot([alpha, beta, gamma], "a", true);
    const result = pushScopedRoot({
      activeRoot: base,
      stack: [],
      nextRoot: {
        id: "edge:related",
        label: "Related to AMP-1087",
        items: [beta, gamma],
        selectedId: "b",
        previewOpen: true,
      },
    });
    expect(result.activeRoot).toMatchObject({ id: "edge:related", label: "Related to AMP-1087", items: [beta, gamma], selectedId: "b", previewOpen: true, base: false });
    expect(result.stack).toEqual([base]);
  });

  it("allows empty scoped roots", () => {
    const base = createBaseRoot([alpha], "a", true);
    const result = pushScopedRoot({
      activeRoot: base,
      stack: [],
      nextRoot: {
        id: "edge:empty",
        label: "Related to AMP-1087",
        items: [],
        selectedId: null,
        previewOpen: true,
      },
    });
    expect(result.activeRoot.items).toEqual([]);
    expect(result.activeRoot.selectedId).toBeNull();
  });

  it("returns to the previous root and restores valid selection", () => {
    const base = createBaseRoot([alpha, beta], "a", true);
    const scoped = pushScopedRoot({
      activeRoot: base,
      stack: [],
      nextRoot: { id: "edge", label: "Related", items: [beta], selectedId: "b", previewOpen: true },
    });
    const returned = returnToPreviousRoot({ activeRoot: scoped.activeRoot, stack: scoped.stack, getId });
    expect(returned.activeRoot).toEqual(base);
    expect(returned.stack).toEqual([]);
  });

  it("clears restored selection when the selected id no longer exists", () => {
    const staleBase = { ...createBaseRoot([alpha], "missing", true), selectedId: "missing" };
    const scoped = pushScopedRoot({
      activeRoot: staleBase,
      stack: [],
      nextRoot: { id: "edge", label: "Related", items: [beta], selectedId: "b", previewOpen: true },
    });
    const returned = returnToPreviousRoot({ activeRoot: scoped.activeRoot, stack: scoped.stack, getId });
    expect(returned.activeRoot.selectedId).toBeNull();
    expect(returned.activeRoot.previewOpen).toBe(false);
  });
});
