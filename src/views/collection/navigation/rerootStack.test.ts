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

  it("supports two-level re-rooting: each Back step unwinds exactly one scope", () => {
    const base = createBaseRoot([alpha, beta, gamma], "a", true);
    const scope1 = pushScopedRoot({
      activeRoot: base,
      stack: [],
      nextRoot: { id: "edge:scope1", label: "Scope 1", items: [beta, gamma], selectedId: "b", previewOpen: true },
    });
    // scope1.stack = [base], scope1.activeRoot is the scoped root
    const scope2 = pushScopedRoot({
      activeRoot: scope1.activeRoot,
      stack: scope1.stack,
      nextRoot: { id: "edge:scope2", label: "Scope 2", items: [gamma], selectedId: "c", previewOpen: true },
    });
    // scope2.stack = [base, scope1.activeRoot]

    const returnedToScope1 = returnToPreviousRoot({
      activeRoot: scope2.activeRoot,
      stack: scope2.stack,
      getId,
    });
    expect(returnedToScope1.activeRoot.id).toBe("edge:scope1");
    expect(returnedToScope1.stack).toHaveLength(1);
    expect(returnedToScope1.stack[0].id).toBe("base");

    const returnedToBase = returnToPreviousRoot({
      activeRoot: returnedToScope1.activeRoot,
      stack: returnedToScope1.stack,
      getId,
    });
    expect(returnedToBase.activeRoot.id).toBe("base");
    expect(returnedToBase.stack).toHaveLength(0);
  });
});
