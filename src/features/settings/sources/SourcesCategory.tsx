import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelJiraIssueIngestion,
  loadJiraIssueIngestionProgress,
  loadSourcesConfig,
  removeSource,
  runJiraIssueIngestion,
} from "../../../sources/storage";
import type {
  JiraIssueIngestionProgress,
  JiraSourceConfig,
  SourcesConfig,
} from "../../../sources/types";
import { SourceList } from "./SourceList";
import { AddSourceFlow } from "./AddSourceFlow";
import { JiraSourceForm } from "./JiraSourceForm";

type Mode = "list" | "choose-kind" | "new-jira" | "edit-jira";

export function SourcesCategory() {
  const [config, setConfig] = useState<SourcesConfig>({ version: 1, sources: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("list");
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [progressBySourceId, setProgressBySourceId] = useState<
    Record<string, JiraIssueIngestionProgress | null>
  >({});
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadSourcesConfig()
      .then((cfg) => { setConfig(cfg); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, []);

  const refreshProgress = useCallback(async (sourceIds: string[]) => {
    if (sourceIds.length === 0) return;
    const entries = await Promise.all(
      sourceIds.map(async (id) => {
        try {
          const p = await loadJiraIssueIngestionProgress(id);
          return [id, p] as const;
        } catch {
          return [id, null] as const;
        }
      })
    );
    setProgressBySourceId((prev) => {
      const next = { ...prev };
      for (const [id, p] of entries) next[id] = p;
      return next;
    });
  }, []);

  useEffect(() => {
    const ids = config.sources.map((s) => s.id);
    if (ids.length > 0) {
      void refreshProgress(ids);
    }
  }, [config.sources, refreshProgress]);

  // Polling: when any source is running, poll every 2s for just those sources.
  useEffect(() => {
    const runningIds = Object.entries(progressBySourceId)
      .filter(([, p]) => p?.status === "running")
      .map(([id]) => id);

    if (runningIds.length === 0) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(() => {
      void refreshProgress(runningIds);
    }, 2000);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [progressBySourceId, refreshProgress]);

  async function handleRemoveConfirm(sourceId: string) {
    const result = await removeSource(sourceId);
    if (result.ok) {
      setConfig((prev) => ({
        ...prev,
        sources: prev.sources.filter((s) => s.id !== sourceId),
      }));
      setPendingRemoveId(null);
    } else {
      setError(result.error);
    }
  }

  function handleEdit(sourceId: string) {
    setEditingSourceId(sourceId);
    setMode("edit-jira");
  }

  function handleSaved(updatedConfig: SourcesConfig) {
    setConfig(updatedConfig);
    setEditingSourceId(null);
    setMode("list");
  }

  function handleCancel() {
    setEditingSourceId(null);
    setMode("list");
  }

  async function handleRunSync(sourceId: string) {
    const result = await runJiraIssueIngestion(sourceId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await refreshProgress([sourceId]);
  }

  async function handleCancelSync(sourceId: string, runId: string) {
    const result = await cancelJiraIssueIngestion(sourceId, runId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await refreshProgress([sourceId]);
  }

  if (mode === "choose-kind") {
    return (
      <AddSourceFlow
        onSelectJira={() => setMode("new-jira")}
        onCancel={handleCancel}
      />
    );
  }

  if (mode === "new-jira") {
    return (
      <JiraSourceForm
        mode="new"
        config={config}
        onSaved={handleSaved}
        onCancel={handleCancel}
      />
    );
  }

  if (mode === "edit-jira" && editingSourceId) {
    const source = config.sources.find((s) => s.id === editingSourceId) as JiraSourceConfig | undefined;
    return (
      <JiraSourceForm
        mode="edit"
        existingSource={source}
        config={config}
        onSaved={handleSaved}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <section aria-labelledby="sources-heading" className="space-y-6">
      <div>
        <h1 id="sources-heading" className="text-lg font-semibold text-text">Sources</h1>
        <p className="text-sm text-subtext mt-1">
          Configure the systems hm reads from. Secrets are stored in the OS keychain.
        </p>
      </div>
      {error && <p className="text-sm text-red">{error}</p>}
      {!loading && (
        <>
          <button
            type="button"
            onClick={() => setMode("choose-kind")}
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-on-primary"
          >
            Add source
          </button>
          <SourceList
            sources={config.sources}
            pendingRemoveId={pendingRemoveId}
            progressBySourceId={progressBySourceId}
            onEdit={handleEdit}
            onRemoveRequest={setPendingRemoveId}
            onRemoveConfirm={handleRemoveConfirm}
            onRemoveCancel={() => setPendingRemoveId(null)}
            onRunSync={handleRunSync}
            onCancelSync={handleCancelSync}
          />
        </>
      )}
    </section>
  );
}
