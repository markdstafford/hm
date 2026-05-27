import type { EntityContract, PropertyDefinition } from "../../views/collection/types";
import type { JiraIssueListItem } from "../../bindings";
import type { JiraIssueProperty } from "./properties";
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

export const jiraIssueEntity: EntityContract<JiraIssueListItem, JiraIssueProperty> = {
  id: "jira-issue",
  label: "Jira issues",
  getId: (item) => item.work_item_id,
  getRowLabel: (item) => {
    const key = item.key || "Unknown key";
    return item.title ? `Open ${key}: ${item.title}` : `Open ${key}`;
  },
  properties: PROPERTY_DEFINITIONS,
  defaultProperties: DEFAULT_PROPERTIES,
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
  Detail: JiraIssueDetail,
  defaultViews: JIRA_ISSUE_DEFAULT_VIEWS,
};
