import { describe, expect, it } from "vitest";
import type { HygieneSuggestion } from "./types";
import {
  ACTION_BUCKET_ORDER,
  CATEGORY_BUCKET_ORDER,
  actionLabel,
  categoryLabel,
  compareHygieneByAssignee,
  compareHygieneByConfidence,
  compareHygieneByKey,
  confidenceBucketFor,
  derivedAssignee,
  derivedKey,
  hygieneFilterableProperties,
} from "./properties";
import { HYGIENE_SUGGESTION_DEFAULT_VIEWS, DEFAULT_PROPERTIES } from "./defaults";
import { hygieneSuggestionEntity } from ".";

const base: HygieneSuggestion = {
  id: "sug-1",
  category: "duplicate",
  action: "merge-as-duplicate",
  confidence: 91,
  rationale: "Same stack trace and title.",
  target: { key: "AMP-1149", title: "Search panel hangs", status: "Open", assignee: null },
  duplicateOf: { key: "AMP-1102", title: "Search panel hangs", status: "Open", assignee: "Tarek Hassan" },
};

describe("hygiene suggestion properties", () => {
  it("maps confidence scores into stable buckets", () => {
    expect(confidenceBucketFor(95)).toEqual({ key: "high", label: "High" });
    expect(confidenceBucketFor(85)).toEqual({ key: "high", label: "High" });
    expect(confidenceBucketFor(84)).toEqual({ key: "medium", label: "Medium" });
    expect(confidenceBucketFor(60)).toEqual({ key: "medium", label: "Medium" });
    expect(confidenceBucketFor(55)).toEqual({ key: "low", label: "Low" });
  });

  it("keeps action and category bucket orders stable", () => {
    expect(ACTION_BUCKET_ORDER.map((bucket) => bucket.label)).toEqual([
      "Close as resolved",
      "Merge as duplicate",
      "Reassign",
      "Ping for context",
      "Enrich title + body",
    ]);
    expect(CATEGORY_BUCKET_ORDER.map((bucket) => bucket.label)).toEqual([
      "Duplicate",
      "Stale",
      "Enrichment",
    ]);
  });

  it("derives readable row values without fake data", () => {
    expect(derivedKey(base)).toBe("AMP-1149 → AMP-1102");
    expect(derivedAssignee(base)).toBe("Unassigned");
    expect(actionLabel("merge-as-duplicate")).toBe("Merge as duplicate");
    expect(categoryLabel("duplicate")).toBe("Duplicate");
  });

  it("sorts confidence numerically and text with missing values last", () => {
    const low = { ...base, id: "low", confidence: 40 };
    const high = { ...base, id: "high", confidence: 99 };
    expect(compareHygieneByConfidence(low, high)).toBeLessThan(0);
    expect(compareHygieneByKey({ ...base, target: { ...base.target, key: "AMP-2" } }, { ...base, target: { ...base.target, key: "AMP-10" } })).toBeGreaterThan(0);
    expect(compareHygieneByAssignee({ ...base, target: { ...base.target, assignee: "Priya" } }, base)).toBeLessThan(0);
  });

  it("exposes confidence as a numeric filterable property", () => {
    const confidence = hygieneFilterableProperties.find((row) => row.property === "confidence");
    expect(confidence?.kind).toBe("number");
    expect(confidence?.getValue(base)).toBe(91);
  });
});

describe("hygiene suggestion defaults and entity", () => {
  it("uses the required default property layout", () => {
    expect(DEFAULT_PROPERTIES).toEqual([
      { property: "action", visible: true, side: "left" },
      { property: "key", visible: true, side: "left" },
      { property: "title", visible: true, side: "left" },
      { property: "assignee", visible: true, side: "right" },
      { property: "status", visible: true, side: "right" },
      { property: "category", visible: true, side: "right" },
      { property: "confidence", visible: true, side: "right" },
      { property: "rationale", visible: false, side: "right" },
    ]);
  });

  it("ships All, By action, and High confidence default views", () => {
    expect(HYGIENE_SUGGESTION_DEFAULT_VIEWS.map((view) => view.displayName)).toEqual(["All", "By action", "High confidence"]);
    expect(HYGIENE_SUGGESTION_DEFAULT_VIEWS.every((view) => view.entityKind === "hygiene-suggestion")).toBe(true);
    const highConfView = HYGIENE_SUGGESTION_DEFAULT_VIEWS[2].config as { filters: Array<{ id: string; property: string; operator: string; value: string; active: boolean }> };
    expect(highConfView.filters).toEqual([
      { id: "hygiene-confidence-gte-85", property: "confidence", operator: "gte", value: "85", active: true },
    ]);
  });

  it("assembles an entity contract with accessible row labels", () => {
    expect(hygieneSuggestionEntity.id).toBe("hygiene-suggestion");
    expect(hygieneSuggestionEntity.getId(base)).toBe("sug-1");
    expect(hygieneSuggestionEntity.getRowLabel?.(base)).toContain("Merge as duplicate");
    expect(hygieneSuggestionEntity.getRowLabel?.(base)).toContain("AMP-1149 → AMP-1102");
    expect(hygieneSuggestionEntity.sortableProperties?.map((row) => row.property)).toEqual(["action", "category", "confidence", "status", "assignee", "key", "title"]);
    expect(hygieneSuggestionEntity.groupableProperties?.map((row) => row.property)).toEqual(["action", "category", "confidence", "status", "assignee"]);
  });
});
