import type { JiraIssueListItem } from "../../bindings";
import type { PreviewFieldConfig, PreviewFieldDefinition, PreviewFieldSourceConfig } from "../../views/collection/types";
import { resolvePreviewFieldConfig } from "../../views/collection/preview/fieldModel";
import { AssigneeCell, LabelsCell, PriorityCell, UpdatedCell } from "./cells";
import type { JiraIssueProperty } from "./properties";

function emptyString(value: string | null | undefined): boolean {
  return !value?.trim();
}

export const JIRA_ISSUE_PREVIEW_FIELDS: PreviewFieldDefinition<JiraIssueListItem, JiraIssueProperty>[] = [
  {
    property: "priority",
    label: "Priority",
    renderCell: (props) => <PriorityCell {...props} />,
    isEmpty: (item) => emptyString(item.priority_name),
  },
  {
    property: "project_key",
    label: "Project",
    renderCell: ({ item }) => <span className="font-mono text-xs text-subtext">{item.project_key}</span>,
    isEmpty: (item) => emptyString(item.project_key),
  },
  {
    property: "assignee",
    label: "Assignee",
    renderCell: (props) => <AssigneeCell {...props} />,
    isEmpty: (item) => emptyString(item.assignee_display_name),
  },
  {
    property: "labels",
    label: "Labels",
    renderCell: (props) => <LabelsCell {...props} />,
    isEmpty: (item) => !item.labels || item.labels.length === 0,
  },
  {
    property: "updated_at_source",
    label: "Updated",
    renderCell: (props) => <UpdatedCell {...props} />,
    isEmpty: (item) => emptyString(item.updated_at_source),
  },
];

export const JIRA_ISSUE_DEFAULT_PREVIEW_FIELDS: PreviewFieldConfig<JiraIssueProperty>[] = [
  { property: "priority", tier: 1 },
  { property: "project_key", tier: 1 },
  { property: "assignee", tier: 1 },
  { property: "labels", tier: 2 },
  { property: "updated_at_source", tier: 2 },
];

// JiraIssueListItem does not yet expose source_id; sourceId: null matches null-keyed source configs
// and will be threaded through once the backend binding exposes it.
export function resolveJiraIssuePreviewFieldConfig(
  sourceConfigs: PreviewFieldSourceConfig<JiraIssueProperty>[] = [],
): PreviewFieldConfig<JiraIssueProperty>[] {
  return resolvePreviewFieldConfig({
    definitions: JIRA_ISSUE_PREVIEW_FIELDS,
    defaults: JIRA_ISSUE_DEFAULT_PREVIEW_FIELDS,
    sourceConfigs,
    entityId: "jira-issue",
    sourceId: null,
  });
}
