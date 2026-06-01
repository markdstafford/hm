import { describe, expect, it, vi } from "vitest";
import type { QuickSwitcherSource } from "./types";
import { buildQuickSwitcherResults, normalizeQuickSwitcherQuery } from "./search";
import type { JiraIssueListItem } from "../../bindings";
import { createJiraQuickSwitcherSource } from "./jiraSource";

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

function source(sourceId = "jira"): QuickSwitcherSource {
  const src = {
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
    toQuickSwitcherItem: (item: Item) => ({
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
  return src as unknown as QuickSwitcherSource;
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

  it("includes title substring matches below word-prefix matches", () => {
    const results = buildQuickSwitcherResults({ sources: [source()], query: "ardinality" });
    expect(results[0].item.primaryLabel).toBe("AMP-1087");
    expect(results[0].match.kind).toBe("title-substring");
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

const jiraIssues: JiraIssueListItem[] = [
  {
    work_item_id: "wi-1087",
    key: "AMP-1087",
    title: "Cardinality mismatch in sync retries",
    status_name: "Open",
    assignee_display_name: "Elena",
    updated_at_source: "2026-05-31T10:00:00Z",
    project_key: "AMP",
    priority_name: "P3",
    labels: ["sync", "cardinality"],
  },
];

describe("createJiraQuickSwitcherSource", () => {
  it("maps Jira issue list items into generic quick-switcher items", () => {
    const openItem = vi.fn().mockReturnValue(true);
    const source = createJiraQuickSwitcherSource({ issues: jiraIssues, openIssue: openItem });
    const item = source.toQuickSwitcherItem(jiraIssues[0]);

    expect(source.id).toBe("jira-issues");
    expect(source.entity.id).toBe("jira-issue");
    expect(item).toMatchObject({
      id: "wi-1087",
      sourceId: "jira-issues",
      entityId: "jira-issue",
      kindLabel: "Jira",
      primaryLabel: "AMP-1087",
      title: "Cardinality mismatch in sync retries",
      contextLabel: "AMP · Open · P3 · Elena",
    });
    expect(item.searchableText).toEqual(expect.arrayContaining(["AMP-1087", "Cardinality mismatch in sync retries", "AMP", "Open", "P3", "Elena", "sync", "cardinality"]));
  });

  it("delegates open behavior to the supplied collection handoff", () => {
    const openIssue = vi.fn().mockReturnValue(true);
    const source = createJiraQuickSwitcherSource({ issues: jiraIssues, openIssue });
    expect(source.openItem(jiraIssues[0], { openPreview: true })).toBe(true);
    expect(openIssue).toHaveBeenCalledWith("wi-1087", { openPreview: true, scopedFallback: true });
  });
});
