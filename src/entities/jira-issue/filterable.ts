import type { JiraIssueListItem } from "../../bindings";
import type { JiraIssueProperty } from "./properties";
import type { FilterableProperty } from "../../views/collection/types";
import type { FilterOption, FilterOptionContext } from "../../views/collection/filter/types";

/** Derive stable sorted unique non-empty option labels from loaded items. */
export function optionsFromItems(
  items: JiraIssueListItem[],
  property: "status_name" | "assignee_display_name" | "priority_name" | "project_key",
): FilterOption[] {
  const seen = new Set<string>();
  for (const item of items) {
    const value = item[property];
    if (value !== null && value !== undefined && value !== "") {
      seen.add(value);
    }
  }
  return [...seen]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ id: value, label: value }));
}

/** Derive stable sorted unique non-empty label options from all items' labels arrays. */
export function labelOptionsFromItems(items: JiraIssueListItem[]): FilterOption[] {
  const seen = new Set<string>();
  for (const item of items) {
    for (const label of item.labels) {
      if (label !== "") {
        seen.add(label);
      }
    }
  }
  return [...seen]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ id: value, label: value }));
}

function statusOptions(context: FilterOptionContext<JiraIssueListItem>): FilterOption[] {
  const preloaded = context.optionsByProperty?.["status"];
  if (preloaded && preloaded.length > 0) return preloaded;
  return optionsFromItems(context.items, "status_name");
}

function assigneeOptions(context: FilterOptionContext<JiraIssueListItem>): FilterOption[] {
  const preloaded = context.optionsByProperty?.["assignee"];
  if (preloaded && preloaded.length > 0) return preloaded;
  return optionsFromItems(context.items, "assignee_display_name");
}

function priorityOptions(context: FilterOptionContext<JiraIssueListItem>): FilterOption[] {
  const preloaded = context.optionsByProperty?.["priority"];
  if (preloaded && preloaded.length > 0) return preloaded;
  return optionsFromItems(context.items, "priority_name");
}

function projectOptions(context: FilterOptionContext<JiraIssueListItem>): FilterOption[] {
  const preloaded = context.optionsByProperty?.["project_key"];
  if (preloaded && preloaded.length > 0) return preloaded;
  return optionsFromItems(context.items, "project_key");
}

function labelOptions(context: FilterOptionContext<JiraIssueListItem>): FilterOption[] {
  const preloaded = context.optionsByProperty?.["labels"];
  if (preloaded && preloaded.length > 0) return preloaded;
  return labelOptionsFromItems(context.items);
}

export const jiraIssueFilterableProperties: FilterableProperty<
  JiraIssueListItem,
  JiraIssueProperty
>[] = [
  { property: "key", kind: "text", getValue: (item: JiraIssueListItem) => item.key },
  { property: "title", kind: "text", getValue: (item: JiraIssueListItem) => item.title },
  { property: "status", kind: "select", getValue: (item: JiraIssueListItem) => item.status_name, options: statusOptions },
  { property: "assignee", kind: "person", getValue: (item: JiraIssueListItem) => item.assignee_display_name, options: assigneeOptions },
  { property: "updated_at_source", kind: "date", getValue: (item: JiraIssueListItem) => item.updated_at_source },
  { property: "priority", kind: "select", getValue: (item: JiraIssueListItem) => item.priority_name, options: priorityOptions },
  { property: "project_key", kind: "select", getValue: (item: JiraIssueListItem) => item.project_key, options: projectOptions },
  { property: "labels", kind: "multi-select", getValue: (item: JiraIssueListItem) => item.labels, options: labelOptions },
];
