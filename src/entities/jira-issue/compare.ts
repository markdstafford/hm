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
