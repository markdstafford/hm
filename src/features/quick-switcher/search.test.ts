import { describe, expect, it, vi } from "vitest";
import type { QuickSwitcherSource } from "./types";
import { buildQuickSwitcherResults, normalizeQuickSwitcherQuery } from "./search";

type Item = {
  id: string;
  key: string;
  title: string;
  project?: string;
  status?: string;
};

const items: Item[] = [
  { id: "1", key: "AMP-1087", title: "Cardinality mismatch in sync retries", project: "AMP", status: "Open" },
  { id: "2", key: "AMP-1014", title: "Create LSP shim", project: "AMP", status: "In progress" },
  { id: "3", key: "OPS-190", title: "LSP planning cleanup", project: "OPS", status: "Backlog" },
  { id: "4", key: "AMP-1001", title: "Deprecated JSCA path", project: "AMP", status: "Done" },
];

function source(sourceId = "jira"): QuickSwitcherSource<Item> {
  return {
    id: sourceId,
    entity: {
      id: "jira-issue",
      label: "Jira issues",
      getId: (item: Item) => item.id,
      properties: [],
      defaultProperties: [],
      defaultSort: (a: Item, b: Item) => a.key.localeCompare(b.key),
      Detail: () => null,
      defaultViews: [],
    },
    items,
    toQuickSwitcherItem: (item) => ({
      id: `jira:${item.id}`,
      sourceId,
      entityId: "jira-issue",
      kindLabel: "Jira",
      primaryLabel: item.key,
      title: item.title,
      contextLabel: [item.project, item.status].filter(Boolean).join(" · "),
      item,
      searchableText: [item.key, item.title, item.project ?? "", item.status ?? ""],
      rankBoosts: {
        exact: [item.key],
        prefix: [item.key],
      },
    }),
    openItem: vi.fn(),
  };
}

describe("normalizeQuickSwitcherQuery", () => {
  it("lowercases, trims, collapses whitespace, and strips punctuation around keys", () => {
    expect(normalizeQuickSwitcherQuery("  AMP-1087!!!  ")).toBe("amp-1087");
    expect(normalizeQuickSwitcherQuery(" LSP   shim ")).toBe("lsp shim");
  });
});

describe("buildQuickSwitcherResults", () => {
  it("returns deterministic default results for an empty query", () => {
    const results = buildQuickSwitcherResults({ sources: [source()], query: "" });
    expect(results.map((result) => result.item.primaryLabel)).toEqual([
      "AMP-1087",
      "AMP-1014",
      "OPS-190",
      "AMP-1001",
    ]);
    expect(results[0].match.kind).toBe("default");
  });

  it("ranks exact key matches above key prefixes and title matches", () => {
    const results = buildQuickSwitcherResults({ sources: [source()], query: "AMP-1087" });
    expect(results[0].item.primaryLabel).toBe("AMP-1087");
    expect(results[0].match.kind).toBe("exact");
  });

  it("ranks key prefixes above title word-prefix matches", () => {
    const results = buildQuickSwitcherResults({ sources: [source()], query: "AMP-10" });
    expect(results.slice(0, 3).map((result) => result.item.primaryLabel)).toEqual([
      "AMP-1087",
      "AMP-1014",
      "AMP-1001",
    ]);
    expect(results[0].match.kind).toBe("prefix");
  });

  it("ranks title word-prefix matches above title substrings", () => {
    const results = buildQuickSwitcherResults({ sources: [source()], query: "LSP" });
    expect(results.map((result) => result.item.primaryLabel)).toEqual(["AMP-1014", "OPS-190"]);
    expect(results[0].match.kind).toBe("title-word-prefix");
  });

  it("includes context substring matches below title matches", () => {
    const results = buildQuickSwitcherResults({ sources: [source()], query: "backlog" });
    expect(results.map((result) => result.item.primaryLabel)).toEqual(["OPS-190"]);
    expect(results[0].match.kind).toBe("context-substring");
  });

  it("returns no results when nothing matches", () => {
    expect(buildQuickSwitcherResults({ sources: [source()], query: "not-present" })).toEqual([]);
  });

  it("uses source order and item order as stable tie breakers", () => {
    const secondSource = source("second");
    const results = buildQuickSwitcherResults({ sources: [source("first"), secondSource], query: "AMP" });
    expect(results.slice(0, 4).map((result) => `${result.source.id}:${result.item.primaryLabel}`)).toEqual([
      "first:AMP-1087",
      "first:AMP-1014",
      "first:AMP-1001",
      "second:AMP-1087",
    ]);
  });
});
