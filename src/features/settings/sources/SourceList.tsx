import type { JiraIssueIngestionProgress } from "../../../bindings";
import { formatLocalDateTime } from "../../../lib/formatDateTime";
import type { SourceConfig } from "../../../sources/types";
import { Button } from "../../../ui/buttons/Button";
import { Card } from "../../../ui/layout/Card";
import { AlertDialog } from "../../../ui/overlays/AlertDialog";

interface SourceListProps {
  sources: SourceConfig[];
  pendingRemoveId: string | null;
  progressBySourceId: Record<string, JiraIssueIngestionProgress | null>;
  onEdit: (sourceId: string) => void;
  onRemoveRequest: (sourceId: string) => void;
  onRemoveConfirm: (sourceId: string) => void;
  onRemoveCancel: () => void;
  onRunSync: (sourceId: string) => void;
  onCancelSync: (sourceId: string, runId: string) => void;
}

export function SourceList({
  sources,
  pendingRemoveId,
  progressBySourceId,
  onEdit,
  onRemoveRequest,
  onRemoveConfirm,
  onRemoveCancel,
  onRunSync,
  onCancelSync,
}: SourceListProps) {
  if (sources.length === 0) {
    return (
      <p className="text-sm text-subtext">
        Add your first source to tell hm where to read work data.
      </p>
    );
  }

  const pendingSource = pendingRemoveId
    ? sources.find((s) => s.id === pendingRemoveId)
    : undefined;
  const pendingDisplayName = pendingSource
    ? pendingSource.name ||
      (() => {
        try {
          return new URL(pendingSource.server_url).hostname;
        } catch {
          return pendingSource.server_url;
        }
      })()
    : "";

  return (
    <>
      <ul className="space-y-3">
        {sources.map((source) => {
          const jira = source; // SourceConfig is { kind: "Jira" } & JiraSourceConfig
          const host = (() => {
            try {
              return new URL(jira.server_url).hostname;
            } catch {
              return jira.server_url;
            }
          })();
          const displayName = jira.name || host;
          const projectSummary =
            jira.projects.length === 0
              ? "No projects selected"
              : jira.projects.length === 1
              ? jira.projects[0].key
              : `${jira.projects.length} projects: ${jira.projects.map((p) => p.key).join(", ")}`;

          const progress = progressBySourceId[jira.id] ?? null;
          const running = progress?.status === "running";
          const statusMessage = progress ? progress.message : "Not synced";
          let progressLine: string | null = null;
          if (progress) {
            if (typeof progress.total_issues === "number") {
              progressLine = `Progress: ${progress.saved_issues} of ${progress.total_issues} issues saved`;
              if (
                typeof progress.current_page === "number" &&
                typeof progress.total_pages === "number"
              ) {
                progressLine += ` · page ${progress.current_page} of ${progress.total_pages}`;
              }
              if (progress.phase && progress.phase.length > 0) {
                progressLine += ` · ${progress.phase}`;
              }
            } else if (progress.saved_issues > 0) {
              progressLine = `Progress: ${progress.saved_issues} issues saved`;
            }
          }
          return (
            <li key={jira.id}>
              <Card>
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-medium text-sm text-text truncate">{displayName}</div>
                    <div className="text-xs text-subtext">Kind: Jira · {host}</div>
                    <div className="text-xs text-subtext">{projectSummary}</div>
                    {jira.last_connection_test && (
                      <div className="text-xs text-subtext">
                        Last test: {jira.last_connection_test.status} — {jira.last_connection_test.message}
                      </div>
                    )}
                    <div
                      role="status"
                      aria-live="polite"
                      className="pt-1 space-y-0.5"
                    >
                      <div className="text-xs text-subtext">
                        Status: {statusMessage}
                      </div>
                      {progressLine && (
                        <div className="text-xs text-subtext">{progressLine}</div>
                      )}
                      {progress?.last_successful_issue_sync_at && (
                        <div className="text-xs text-subtext">
                          Last successful issue sync: {formatLocalDateTime(progress.last_successful_issue_sync_at)}
                        </div>
                      )}
                      {progress?.error_summary && (
                        <div className="text-xs text-red">
                          Error: {progress.error_summary}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEdit(jira.id)}
                      className="px-2 py-1 rounded text-xs font-medium text-subtext hover:text-text hover:bg-surface transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveRequest(jira.id)}
                      className="px-2 py-1 rounded text-xs font-medium text-subtext hover:text-text hover:bg-surface transition-colors"
                    >
                      Remove
                    </button>
                    {running && progress ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCancelSync(jira.id, progress.run_id)}
                      >
                        Cancel sync
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => onRunSync(jira.id)}>
                        Run sync now
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <AlertDialog.Root
        open={!!pendingSource}
        onOpenChange={(open) => {
          if (!open) onRemoveCancel();
        }}
      >
        <AlertDialog.Content>
          <AlertDialog.Title className="text-sm font-semibold text-text">
            Remove source?
          </AlertDialog.Title>
          <AlertDialog.Description className="text-xs text-subtext mt-2">
            Removes <span className="font-mono">{pendingDisplayName}</span>. The
            credential secret stored in the OS keychain is also deleted.
          </AlertDialog.Description>
          <div className="flex justify-end gap-2 mt-4">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant="destructive"
                onClick={() => pendingSource && onRemoveConfirm(pendingSource.id)}
              >
                Remove source
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  );
}
