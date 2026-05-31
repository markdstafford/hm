import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { JiraIssueListItem } from "../../bindings";
import type { PreviewFieldSourceConfig } from "../../views/collection/types";
import { partitionPreviewFields } from "../../views/collection/preview/fieldModel";
import {
  JIRA_ISSUE_DEFAULT_PREVIEW_FIELDS,
  JIRA_ISSUE_PREVIEW_FIELDS,
  resolveJiraIssuePreviewFieldConfig,
} from "./previewFields";
import type { JiraIssueProperty } from "./properties";


function item(overrides: Partial<JiraIssueListItem> = {}): JiraIssueListItem {
  return {
    work_item_id: "wi_amp_1043",
    key: "AMP-1043",
    title: "Fix generated relationship labels",
    status_name: "To Do",
    assignee_display_name: "Elena",
    updated_at_source: "2024-06-01T10:00:00Z",
    project_key: "AMP",
    priority_name: "P1",
    labels: ["preview", "triage"],
    ...overrides,
  };
}

describe("Jira preview fields", () => {
  it("declares defaults for available fields without inventing issue type", () => {
    expect(JIRA_ISSUE_PREVIEW_FIELDS.map((field) => field.property)).toEqual([
      "priority",
      "project_key",
      "assignee",
      "labels",
      "updated_at_source",
    ]);
    expect(JIRA_ISSUE_DEFAULT_PREVIEW_FIELDS).toEqual([
      { property: "priority", tier: 1 },
      { property: "project_key", tier: 1 },
      { property: "assignee", tier: 1 },
      { property: "labels", tier: 2 },
      { property: "updated_at_source", tier: 2 },
    ]);
  });

  it("omits empty Jira fields before partitioning", () => {
    const result = partitionPreviewFields(
      item({ priority_name: null, assignee_display_name: null, labels: [], updated_at_source: null }),
      JIRA_ISSUE_PREVIEW_FIELDS,
      JIRA_ISSUE_DEFAULT_PREVIEW_FIELDS,
    );

    expect(result.tierOne.map((field) => field.definition.property)).toEqual(["project_key"]);
    expect(result.secondary).toEqual([]);
    expect(result.hiddenEmpty.map((field) => field.definition.property)).toEqual([
      "priority",
      "assignee",
      "labels",
      "updated_at_source",
    ]);
  });

  it("resolves effective config from defaults when no source config exists", () => {
    expect(resolveJiraIssuePreviewFieldConfig()).toEqual(JIRA_ISSUE_DEFAULT_PREVIEW_FIELDS);
  });

  it("promotes a field when a matching source config (sourceId: null) overrides its tier", () => {
    const sourceConfigs: PreviewFieldSourceConfig<JiraIssueProperty>[] = [
      {
        sourceId: null,
        entityId: "jira-issue",
        fields: [{ property: "labels", tier: 1 }],
      },
    ];
    const result = resolveJiraIssuePreviewFieldConfig(sourceConfigs);
    const labels = result.find((f) => f.property === "labels");
    expect(labels?.tier).toBe(1);
    const priority = result.find((f) => f.property === "priority");
    expect(priority?.tier).toBe(1);
  });

  it("keeps non-matching source configs isolated — a different sourceId does not promote fields", () => {
    const sourceConfigs: PreviewFieldSourceConfig<JiraIssueProperty>[] = [
      {
        sourceId: "jira-other",
        entityId: "jira-issue",
        fields: [{ property: "labels", tier: 1 }],
      },
    ];
    const result = resolveJiraIssuePreviewFieldConfig(sourceConfigs);
    const labels = result.find((f) => f.property === "labels");
    expect(labels?.tier).toBe(2);
  });

  it("resolver + partition: matching source config (sourceId: null) promotes labels to tier 1 and non-matching sourceId stays isolated", () => {
    const withLabels = item({ labels: ["promoted"] });

    const matchingConfig: PreviewFieldSourceConfig<JiraIssueProperty>[] = [
      { sourceId: null, entityId: "jira-issue", fields: [{ property: "labels", tier: 1 }] },
    ];
    const resolved = resolveJiraIssuePreviewFieldConfig(matchingConfig);
    const promoted = partitionPreviewFields(withLabels, JIRA_ISSUE_PREVIEW_FIELDS, resolved);
    expect(promoted.tierOne.map((f) => f.definition.property)).toContain("labels");
    expect(promoted.secondary.map((f) => f.definition.property)).not.toContain("labels");

    const nonMatchingConfig: PreviewFieldSourceConfig<JiraIssueProperty>[] = [
      { sourceId: "jira-other", entityId: "jira-issue", fields: [{ property: "labels", tier: 1 }] },
    ];
    const resolvedNonMatch = resolveJiraIssuePreviewFieldConfig(nonMatchingConfig);
    const notPromoted = partitionPreviewFields(withLabels, JIRA_ISSUE_PREVIEW_FIELDS, resolvedNonMatch);
    expect(notPromoted.secondary.map((f) => f.definition.property)).toContain("labels");
    expect(notPromoted.tierOne.map((f) => f.definition.property)).not.toContain("labels");
  });

  it("reuses existing cell renderers for priority, labels, project, assignee, and updated date", () => {
    const jira = item();

    for (const definition of JIRA_ISSUE_PREVIEW_FIELDS) {
      render(<>{definition.renderCell?.({ item: jira, property: definition.property })}</>);
    }

    expect(screen.getByText("P1")).toBeInTheDocument();
    expect(screen.getByText("AMP")).toBeInTheDocument();
    expect(screen.getByText("Elena")).toBeInTheDocument();
    expect(screen.getByText("preview")).toBeInTheDocument();
    expect(screen.getByText("triage")).toBeInTheDocument();
    expect(screen.getByTestId("updated-cell")).toBeInTheDocument();
  });
});
