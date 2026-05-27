import type { JiraIssueListItem } from "../../bindings";

export function compareStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

export function compareNumbers(a: number, b: number): number {
  return a - b;
}

export function compareDates(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime();
}

export function compareNullLast<T>(
  inner: (a: T, b: T) => number
): (a: T | null, b: T | null) => number {
  return (a, b) => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return inner(a, b);
  };
}

const compareDatesDescNullLast = compareNullLast(
  (a: string, b: string) => -compareDates(a, b)
);

export function defaultJiraSort(a: JiraIssueListItem, b: JiraIssueListItem): number {
  const result = compareDatesDescNullLast(a.updated_at_source, b.updated_at_source);
  return result === 0 ? 0 : result;
}

function normalizeString(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export const compareNullableStringsNullLast = compareNullLast(compareStrings);

function compareNormalizedStrings(a: string | null | undefined, b: string | null | undefined): number {
  return compareNullableStringsNullLast(normalizeString(a), normalizeString(b));
}

export function compareJiraIssueByKey(a: JiraIssueListItem, b: JiraIssueListItem): number {
  return compareNormalizedStrings(a.key, b.key);
}
export function compareJiraIssueByTitle(a: JiraIssueListItem, b: JiraIssueListItem): number {
  return compareNormalizedStrings(a.title, b.title);
}
export function compareJiraIssueByStatus(a: JiraIssueListItem, b: JiraIssueListItem): number {
  return compareNormalizedStrings(a.status_name, b.status_name);
}
export function compareJiraIssueByAssignee(a: JiraIssueListItem, b: JiraIssueListItem): number {
  return compareNormalizedStrings(a.assignee_display_name, b.assignee_display_name);
}
export function compareJiraIssueByUpdated(a: JiraIssueListItem, b: JiraIssueListItem): number {
  return compareNullLast(compareDates)(a.updated_at_source, b.updated_at_source);
}
export function compareJiraIssueByPriority(a: JiraIssueListItem, b: JiraIssueListItem): number {
  return compareNormalizedStrings(a.priority_name, b.priority_name);
}
export function compareJiraIssueByProjectKey(a: JiraIssueListItem, b: JiraIssueListItem): number {
  return compareNormalizedStrings(a.project_key, b.project_key);
}
