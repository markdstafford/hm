import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { JiraIssueListItem } from "../../bindings";
import { partitionPreviewFields } from "../../views/collection/preview/fieldModel";
import {
  JIRA_ISSUE_DEFAULT_PREVIEW_FIELDS,
  JIRA_ISSUE_PREVIEW_FIELDS,
} from "./previewFields";

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
