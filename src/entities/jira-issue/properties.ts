import type { BucketDefinition } from "../../views/collection/types";

export type JiraIssueProperty =
  | "key"
  | "title"
  | "status"
  | "assignee"
  | "updated_at_source"
  | "priority"
  | "labels"
  | "project_key";

export type UpdatedAtBucketKey =
  | "today"
  | "yesterday"
  | "this-week"
  | "this-month"
  | "older"
  | "no-updated-date";

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfLocalWeek(date: Date): Date {
  const day = startOfLocalDay(date);
  const dayOfWeek = day.getDay();
  day.setDate(day.getDate() - dayOfWeek);
  return day;
}

function startOfLocalMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function bucketUpdatedAtSource(
  value: string | null | undefined,
  now: Date = new Date(),
): UpdatedAtBucketKey {
  if (!value) return "no-updated-date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "no-updated-date";

  const targetDay = startOfLocalDay(date).getTime();
  const today = startOfLocalDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (targetDay === today.getTime()) return "today";
  if (targetDay === yesterday.getTime()) return "yesterday";
  if (targetDay >= startOfLocalWeek(now).getTime()) return "this-week";
  if (targetDay >= startOfLocalMonth(now).getTime()) return "this-month";
  return "older";
}

export function updatedAtBucketOrder(): BucketDefinition[] {
  return [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "this-week", label: "This week" },
    { key: "this-month", label: "This month" },
    { key: "older", label: "Older" },
    { key: "no-updated-date", label: "No updated date" },
  ];
}
