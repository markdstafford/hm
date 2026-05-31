import { describe, expect, it } from "vitest";
import type { JiraIssueListItem } from "../../bindings";
import { resolveJiraIssueEdges } from "./connections";

function issue(overrides: Partial<JiraIssueListItem> = {}): JiraIssueListItem {
  return {
    work_item_id: overrides.work_item_id ?? "wi-1",
    key: overrides.key ?? "AMP-1087",
    title: overrides.title ?? "Base issue",
    status_name: overrides.status_name ?? "Open",
    assignee_display_name: overrides.assignee_display_name ?? null,
    updated_at_source: overrides.updated_at_source ?? null,
    priority_name: overrides.priority_name ?? null,
    project_key: overrides.project_key ?? "AMP",
    labels: overrides.labels ?? [],
  };
}

type FixtureIssue = JiraIssueListItem & {
  __hmFixtureEdges?: Array<
    | { id: string; kind: "source" | "local" | "suggested"; shape: "single"; relationship: string; targetKey: string; title?: string | null; confidence?: number }
    | { id: string; kind: "source" | "local" | "suggested"; shape: "set"; relationship: string; label: string; targetKeys: string[]; confidence?: number }
  >;
};

describe("resolveJiraIssueEdges", () => {
  it("returns no production edges when Jira list items expose no relationship fields", () => {
    expect(resolveJiraIssueEdges({ item: issue(), allItems: [issue()] })).toEqual([]);
  });

  it("resolves explicit fixture single-target edges against the local issue corpus", () => {
    const base = issue({ key: "AMP-1087", title: "Base" }) as FixtureIssue;
    base.__hmFixtureEdges = [
      { id: "duplicates:AMP-1102", kind: "source", shape: "single", relationship: "duplicates", targetKey: "AMP-1102" },
    ];
    const target = issue({ work_item_id: "wi-2", key: "AMP-1102", title: "Consolidate sync retries" });
    const edges = resolveJiraIssueEdges({ item: base, allItems: [base, target] });
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      id: "duplicates:AMP-1102",
      kind: "source",
      shape: "single",
      relationship: "duplicates",
      targetRef: { entityId: "jira-issue", displayKey: "AMP-1102", title: "Consolidate sync retries" },
      target,
    });
  });

  it("marks explicit fixture targets as not ingested when they are absent locally", () => {
    const base = issue({ key: "AMP-1087" }) as FixtureIssue;
    base.__hmFixtureEdges = [
      { id: "blocks:SEC-441", kind: "source", shape: "single", relationship: "blocks", targetKey: "SEC-441", title: "External secret rotation" },
    ];
    const edges = resolveJiraIssueEdges({ item: base, allItems: [base] });
    expect(edges[0]).toMatchObject({
      danglingReason: "not-ingested",
      targetRef: { displayKey: "SEC-441", title: "External secret rotation" },
    });
  });

  it("resolves explicit fixture set edges against the local issue corpus", () => {
    const base = issue({ key: "AMP-1087" }) as FixtureIssue;
    base.__hmFixtureEdges = [
      { id: "related:set", kind: "local", shape: "set", relationship: "all related", label: "Related to AMP-1087", targetKeys: ["AMP-1102", "AMP-800"] },
    ];
    const first = issue({ work_item_id: "wi-2", key: "AMP-1102" });
    const second = issue({ work_item_id: "wi-3", key: "AMP-800" });
    const edges = resolveJiraIssueEdges({ item: base, allItems: [base, first, second] });
    expect(edges[0]).toMatchObject({ shape: "set", label: "Related to AMP-1087", count: 2, items: [first, second] });
  });
});
