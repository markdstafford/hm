import type { PropertyConfig } from "../../views/collection/types";
import type { JiraIssueProperty } from "./properties";

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
