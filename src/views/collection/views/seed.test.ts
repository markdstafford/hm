import { describe, expect, it } from "vitest";
import type { CollectionView } from "./types";
import {
  activeViewPreferencePatch,
  createFallbackView,
  duplicateViewDraft,
  pickActiveViewId,
  nextPosition,
  uniqueUntitledName,
} from "./seed";

const views: CollectionView[] = [
  { id: "all", entityKind: "jira-issue", displayName: "All open", position: 0, isDefault: true, config: {} },
  { id: "mine", entityKind: "jira-issue", displayName: "Mine", position: 1, isDefault: true, config: {} },
];

describe("collection view seed helpers", () => {
  it("picks saved active view when it still exists", () => {
    expect(pickActiveViewId(views, "mine")).toBe("mine");
  });

  it("falls back to first positioned view when saved id is missing", () => {
    expect(pickActiveViewId(views, "deleted")).toBe("all");
  });

  it("returns null when no views exist", () => {
    expect(pickActiveViewId([], "deleted")).toBeNull();
  });

  it("computes the next position", () => {
    expect(nextPosition(views)).toBe(2);
  });

  it("creates collision-safe untitled names", () => {
    expect(uniqueUntitledName([{ ...views[0], displayName: "Untitled view" }])).toBe("Untitled view 2");
  });

  it("creates a duplicate draft with copy suffix and next position", () => {
    const draft = duplicateViewDraft(views[1], views);
    expect(draft.displayName).toBe("Mine (copy)");
    expect(draft.position).toBe(2);
    expect(draft.config).toEqual({});
  });

  it("creates a safe fallback view for an empty entity", () => {
    expect(createFallbackView("jira-issue")).toMatchObject({
      id: "jira-issue-fallback-view",
      entityKind: "jira-issue",
      displayName: "All open",
      position: 0,
      isDefault: true,
      config: {},
    });
  });

  it("builds active view preference patches", () => {
    expect(activeViewPreferencePatch("jira-issue", "mine")).toEqual({
      collections: { activeViewId: { "jira-issue": "mine" } },
    });
  });
});
