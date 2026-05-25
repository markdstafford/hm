import type { SourceConfig } from "../../../sources/types";
import { Button } from "../../../ui/buttons/Button";
import { Card } from "../../../ui/layout/Card";
import { AlertDialog } from "../../../ui/overlays/AlertDialog";

interface SourceListProps {
  sources: SourceConfig[];
  pendingRemoveId: string | null;
  onEdit: (sourceId: string) => void;
  onRemoveRequest: (sourceId: string) => void;
  onRemoveConfirm: (sourceId: string) => void;
  onRemoveCancel: () => void;
}

export function SourceList({
  sources,
  pendingRemoveId,
  onEdit,
  onRemoveRequest,
  onRemoveConfirm,
  onRemoveCancel,
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
