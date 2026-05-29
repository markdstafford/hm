import { useEffect, useState } from "react";
import { Badge } from "../../ui/data/Badge";
import type { JiraIssueListItem, JiraIssueStatusTransition } from "../../bindings";
import { UpdatedCell } from "./cells";
import { loadJiraIssueStatusHistory } from "./history";
import { Spinner } from "../../ui/feedback/Spinner";
import { EmptyState } from "../../ui/feedback/EmptyState";
import { formatLocalDateTime } from "../../lib/formatDateTime";

type Props = { item: JiraIssueListItem };

type HistoryState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ok"; transitions: JiraIssueStatusTransition[]; partial: boolean };

export function JiraIssueDetail({ item }: Props) {
  const [history, setHistory] = useState<HistoryState>({ phase: "loading" });

  useEffect(() => {
    setHistory({ phase: "loading" });
    let cancelled = false;
    loadJiraIssueStatusHistory(item.work_item_id).then((result) => {
      if (cancelled) return;
      if (result.status === "error") {
        setHistory({ phase: "error" });
      } else {
        setHistory({ phase: "ok", transitions: result.transitions, partial: result.partial });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [item.work_item_id]);

  return (
    <div className="p-4 flex flex-col gap-3">
      <span className="font-mono text-xs text-subtext">{item.key || "Unknown key"}</span>
      <h2 className="text-base font-medium text-text leading-snug">{item.title}</h2>

      <div className="flex items-center gap-2 flex-wrap">
        {item.status_name && <Badge>{item.status_name}</Badge>}
        <span className="text-sm text-subtext">
          {item.assignee_display_name ?? "Unassigned"}
        </span>
      </div>

      {item.project_key && (
        <span
          data-testid="detail-project-key"
          className="font-mono text-xs text-subtext"
        >
          {item.project_key}
        </span>
      )}

      {item.updated_at_source && (
        <span data-testid="detail-updated" className="text-xs text-subtext">
          <UpdatedCell item={item} property="updated_at_source" />
        </span>
      )}

      <section aria-labelledby="jira-status-history-heading" className="mt-2 flex flex-col gap-2">
        <h3 id="jira-status-history-heading" className="text-sm font-medium text-text">
          Status history
        </h3>

        {history.phase === "loading" && (
          <Spinner label="Loading status history…" />
        )}

        {history.phase === "error" && (
          <p role="alert">Could not load status history. Try syncing Jira again.</p>
        )}

        {history.phase === "ok" && history.transitions.length === 0 && (
          <EmptyState
            title="No status changes captured yet."
            description="Run Jira sync to import changelog history."
          />
        )}

        {history.phase === "ok" && history.transitions.length > 0 && (
          <>
            {history.partial && (
              <p className="text-xs text-subtext">
                Showing captured history. Some older changelog pages have not synced yet.
              </p>
            )}
            <ol aria-label="Status history" className="flex flex-col gap-1">
              {history.transitions.map((t) => (
                <li
                  key={t.event_id}
                  className="flex items-center gap-2 text-sm"
                  aria-label={`${t.from_status ?? "Unknown"} to ${t.to_status ?? "Unknown"}, changed ${formatLocalDateTime(t.occurred_at)} by ${t.actor_display_name ?? "Unknown actor"}`}
                >
                  <span>{t.from_status ?? "—"}</span>
                  <span>→</span>
                  <Badge>{t.to_status ?? "Unknown"}</Badge>
                  <span className="text-xs text-subtext">{formatLocalDateTime(t.occurred_at)}</span>
                  <span className="text-xs text-subtext">{t.actor_display_name ?? "Unknown actor"}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </div>
  );
}
