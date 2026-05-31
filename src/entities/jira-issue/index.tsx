import type { EntityContract, GroupableProperty, PropertyDefinition } from "../../views/collection/types";
import type { JiraIssueListItem } from "../../bindings";
import { bucketUpdatedAtSource, updatedAtBucketOrder, type JiraIssueProperty } from "./properties";
import { DEFAULT_PROPERTIES, JIRA_ISSUE_DEFAULT_VIEWS } from "./defaults";
import {
  defaultJiraSort,
  compareJiraIssueByKey,
  compareJiraIssueByTitle,
  compareJiraIssueByStatus,
  compareJiraIssueByAssignee,
  compareJiraIssueByUpdated,
  compareJiraIssueByPriority,
  compareJiraIssueByProjectKey,
} from "./compare";
import { KeyCell, TitleCell, StatusCell, AssigneeCell, UpdatedCell, PriorityCell, LabelsCell } from "./cells";
import { JiraIssueDetail } from "./detail";
import { jiraIssueFilterableProperties } from "./filterable";
import {
  JIRA_ISSUE_DEFAULT_PREVIEW_FIELDS,
  JIRA_ISSUE_PREVIEW_FIELDS,
  resolveJiraIssuePreviewFieldConfig,
} from "./previewFields";

const PROPERTY_DEFINITIONS: PropertyDefinition<JiraIssueListItem, JiraIssueProperty>[] = [
  {
    id: "key",
    label: "Key",
    kind: "text",
    renderCell: (props) => <KeyCell {...props} />,
  },
  {
    id: "title",
    label: "Title",
    kind: "text",
    isStretch: true,
    renderCell: (props) => <TitleCell {...props} />,
  },
  {
    id: "status",
    label: "Status",
    kind: "categorical",
    renderCell: (props) => <StatusCell {...props} />,
  },
  {
    id: "assignee",
    label: "Assignee",
    kind: "text",
    renderCell: (props) => <AssigneeCell {...props} />,
  },
  {
    id: "updated_at_source",
    label: "Updated",
    kind: "date",
    renderCell: (props) => <UpdatedCell {...props} />,
  },
  {
    id: "priority",
    label: "Priority",
    kind: "categorical",
    renderCell: (props) => <PriorityCell {...props} />,
  },
  {
    id: "labels",
    label: "Labels",
    kind: "tags",
    renderCell: (props) => <LabelsCell {...props} />,
  },
  {
    id: "project_key",
    label: "Project",
    kind: "text",
    renderCell: ({ item }) => (
      <span className="font-mono text-xs text-subtext">{item.project_key ?? ""}</span>
    ),
  },
];

// Jira workflow category order; true workflow metadata is not available in list items,
// so we use this stable category order as a deterministic fallback.
const STATUS_CATEGORY_ORDER = ["To do", "In progress", "Done"];

function stableUnique(values: (string | null | undefined)[], fallback: string): string[] {
  const seen = new Set<string>();
  for (const raw of values) {
    const value = raw?.trim() || fallback;
    seen.add(value);
  }
  return [...seen].sort((a, b) => {
    if (a === fallback && b !== fallback) return 1;
    if (b === fallback && a !== fallback) return -1;
    return a.localeCompare(b);
  });
}

const GROUPABLE_PROPERTIES: GroupableProperty<JiraIssueListItem, JiraIssueProperty>[] = [
  {
    property: "status",
    bucketKeyFor: (item) => item.status_name?.trim() || "No status",
    bucketOrder: (items = []) => {
      const discovered = stableUnique(items.map((item) => item.status_name), "No status");
      const ordered = [...STATUS_CATEGORY_ORDER, ...discovered.filter((value) => !STATUS_CATEGORY_ORDER.includes(value))];
      return ordered.map((key) => ({ key, label: key }));
    },
  },
  {
    property: "assignee",
    bucketKeyFor: (item) => item.assignee_display_name?.trim() || "Unassigned",
    bucketOrder: (items = []) =>
      stableUnique(items.map((item) => item.assignee_display_name), "Unassigned").map((key) => ({
        key,
        label: key,
      })),
  },
  {
    property: "priority",
    bucketKeyFor: (item) => item.priority_name?.trim() || "No priority",
    bucketOrder: (items = []) =>
      stableUnique(items.map((item) => item.priority_name), "No priority").map((key) => ({
        key,
        label: key,
      })),
  },
  {
    property: "project_key",
    bucketKeyFor: (item) => item.project_key?.trim() || "No project",
    bucketOrder: (items = []) =>
      stableUnique(items.map((item) => item.project_key), "No project").map((key) => ({
        key,
        label: key,
      })),
  },
  {
    property: "updated_at_source",
    bucketKeyFor: (item, context) => bucketUpdatedAtSource(item.updated_at_source, context?.now),
    bucketOrder: () => updatedAtBucketOrder(),
  },
];

export const jiraIssueEntity: EntityContract<JiraIssueListItem, JiraIssueProperty> = {
  id: "jira-issue",
  label: "Jira issues",
  detailLabel: "issue",
  getId: (item) => item.work_item_id,
  getRowLabel: (item) => {
    const key = item.key || "Unknown key";
    return item.title ? `Open ${key}: ${item.title}` : `Open ${key}`;
  },
  properties: PROPERTY_DEFINITIONS,
  defaultProperties: DEFAULT_PROPERTIES,
  previewFields: JIRA_ISSUE_PREVIEW_FIELDS,
  defaultPreviewFields: JIRA_ISSUE_DEFAULT_PREVIEW_FIELDS,
  resolvePreviewFieldConfig: (_item) => resolveJiraIssuePreviewFieldConfig(),
  defaultSort: defaultJiraSort,
  sortableProperties: [
    { property: "key", compare: compareJiraIssueByKey, isNull: (item) => !item.key?.trim() },
    { property: "title", compare: compareJiraIssueByTitle, isNull: (item) => !item.title?.trim() },
    { property: "status", compare: compareJiraIssueByStatus, isNull: (item) => !item.status_name?.trim() },
    { property: "assignee", compare: compareJiraIssueByAssignee, isNull: (item) => !item.assignee_display_name?.trim() },
    { property: "updated_at_source", compare: compareJiraIssueByUpdated, isNull: (item) => item.updated_at_source === null, defaultDirection: "desc" as const },
    { property: "priority", compare: compareJiraIssueByPriority, isNull: (item) => !item.priority_name?.trim() },
    { property: "project_key", compare: compareJiraIssueByProjectKey, isNull: (item) => !item.project_key?.trim() },
  ],
  groupableProperties: GROUPABLE_PROPERTIES,
  filterableProperties: jiraIssueFilterableProperties,
  Detail: JiraIssueDetail,
  defaultViews: JIRA_ISSUE_DEFAULT_VIEWS,
};
