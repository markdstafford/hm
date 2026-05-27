import type { PropertyConfig } from "../../views/collection/types";
import type { CollectionView } from "../../views/collection/views/types";
import type { JiraIssueProperty } from "./properties";

export const JIRA_ISSUE_DEFAULT_VIEWS: CollectionView[] = [
  {
    id: "jira-issue-all-open",
    entityKind: "jira-issue",
    displayName: "All open",
    position: 0,
    isDefault: true,
    config: {},
  },
  {
    id: "jira-issue-mine",
    entityKind: "jira-issue",
    displayName: "Mine",
    position: 1,
    isDefault: true,
    config: {},
  },
  {
    id: "jira-issue-recently-updated",
    entityKind: "jira-issue",
    displayName: "Recently updated",
    position: 2,
    isDefault: true,
    config: {},
  },
];

export const DEFAULT_PROPERTIES: PropertyConfig<JiraIssueProperty>[] = [
  { property: "key",               side: "left",  visible: true  },
  { property: "title",             side: "left",  visible: true  },
  { property: "assignee",          side: "right", visible: true  },
  { property: "status",            side: "right", visible: true  },
  { property: "updated_at_source", side: "right", visible: true  },
  { property: "priority",          side: "right", visible: false },
  { property: "labels",            side: "right", visible: false },
  { property: "project_key",       side: "right", visible: false },
];
