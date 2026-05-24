import type { SourceConfig } from "../../sources/types";

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

  return (
    <ul className="space-y-3">
      {sources.map((source) => {
        const jira = source; // SourceConfig is { kind: "Jira" } & JiraSourceConfig
        const host = (() => {
          try { return new URL(jira.server_url).hostname; } catch { return jira.server_url; }
        })();
        const displayName = jira.name || host;
        const projectSummary = jira.projects.length === 0
          ? "No projects selected"
          : jira.projects.length === 1
          ? jira.projects[0].key
          : `${jira.projects.length} projects: ${jira.projects.map(p => p.key).join(", ")}`;
        const isPendingRemove = pendingRemoveId === jira.id;

        return (
          <li key={jira.id} className="rounded border border-border p-3 space-y-2">
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
            {isPendingRemove && (
              <div className="rounded bg-surface p-2 text-sm space-y-2">
                <p className="text-text">Remove {displayName}?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onRemoveConfirm(jira.id)}
                    className="px-3 py-1 rounded bg-red text-on-primary text-xs font-medium"
                  >
                    Remove source
                  </button>
                  <button
                    type="button"
                    onClick={onRemoveCancel}
                    className="px-3 py-1 rounded text-subtext hover:text-text text-xs font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
