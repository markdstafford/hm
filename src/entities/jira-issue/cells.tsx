import { Badge } from "../../ui/data/Badge";
import type { JiraIssueListItem } from "../../bindings";
import type { JiraIssueProperty } from "./properties";

type CellProps = { item: JiraIssueListItem; property: JiraIssueProperty };

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffDays > 30)
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(diffDays > 365 && { year: "numeric" }),
    });
  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  if (diffMinutes > 0) return `${diffMinutes}m`;
  return "just now";
}

export function KeyCell({ item }: CellProps) {
  return (
    <span className="font-mono text-xs text-subtext">
      {item.key || "Unknown key"}
    </span>
  );
}

export function TitleCell({ item }: CellProps) {
  return (
    <span className="text-sm text-text truncate">
      {item.title}
    </span>
  );
}

export function StatusCell({ item }: CellProps) {
  if (!item.status_name) return null;
  return <Badge>{item.status_name}</Badge>;
}

export function AssigneeCell({ item }: CellProps) {
  return (
    <span className="text-xs text-subtext">
      {item.assignee_display_name ?? "Unassigned"}
    </span>
  );
}

export function UpdatedCell({ item }: CellProps) {
  if (!item.updated_at_source) return null;
  return (
    <span data-testid="updated-cell" className="text-xs text-subtext">
      {formatRelativeTime(item.updated_at_source)}
    </span>
  );
}
