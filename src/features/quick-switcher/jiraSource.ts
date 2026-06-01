import type { JiraIssueListItem } from "../../bindings";
import { jiraIssueEntity } from "../../entities/jira-issue";
import type { QuickSwitcherOpenOptions, QuickSwitcherSource } from "./types";

export type CreateJiraQuickSwitcherSourceArgs = {
  issues: JiraIssueListItem[];
  loading?: boolean;
  error?: string | null;
  openIssue: (id: string, options?: { openPreview?: boolean; scopedFallback?: boolean }) => boolean;
};

function joinContext(parts: Array<string | null | undefined>): string | undefined {
  const value = parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");
  return value || undefined;
}

export function createJiraQuickSwitcherSource({
  issues,
  loading = false,
  error = null,
  openIssue,
}: CreateJiraQuickSwitcherSourceArgs): QuickSwitcherSource<JiraIssueListItem> {
  return {
    id: "jira-issues",
    entity: jiraIssueEntity,
    items: issues,
    loading,
    error,
    toQuickSwitcherItem: (issue) => ({
      id: issue.work_item_id,
      sourceId: "jira-issues",
      entityId: jiraIssueEntity.id,
      kindLabel: "Jira",
      primaryLabel: issue.key || issue.work_item_id,
      title: issue.title || "Untitled issue",
      contextLabel: joinContext([
        issue.project_key,
        issue.status_name,
        issue.priority_name,
        issue.assignee_display_name,
      ]),
      statusLabel: issue.status_name ?? undefined,
      item: issue,
      searchableText: [
        issue.key,
        issue.title,
        issue.project_key ?? "",
        issue.status_name ?? "",
        issue.priority_name ?? "",
        issue.assignee_display_name ?? "",
        ...issue.labels,
      ],
      rankBoosts: {
        exact: [issue.key, issue.work_item_id],
        prefix: [issue.key],
      },
    }),
    openItem: (issue, options?: QuickSwitcherOpenOptions<JiraIssueListItem>) =>
      openIssue(issue.work_item_id, {
        openPreview: options?.openPreview ?? true,
        scopedFallback: options?.scopedFallback ?? true,
      }),
  };
}
