import type { EntityContract, PropertyDefinition } from "../../views/collection/types";
import type { JiraIssueListItem } from "../../bindings";
import type { JiraIssueProperty } from "./properties";
import { DEFAULT_PROPERTIES } from "./defaults";
import { defaultJiraSort } from "./compare";
import { KeyCell, TitleCell, StatusCell, AssigneeCell, UpdatedCell } from "./cells";
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
    renderCell: () => null,
  },
  {
    id: "labels",
    label: "Labels",
    kind: "tags",
    renderCell: () => null,
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
  properties: PROPERTY_DEFINITIONS,
  defaultProperties: DEFAULT_PROPERTIES,
  defaultSort: defaultJiraSort,
  Detail: JiraIssueDetail,
};
