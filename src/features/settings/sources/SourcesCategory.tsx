import { useEffect, useState } from "react";
import { loadSourcesConfig, removeSource } from "../../../sources/storage";
import type { SourcesConfig, JiraSourceConfig } from "../../../sources/types";
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

  useEffect(() => {
    loadSourcesConfig()
      .then((cfg) => { setConfig(cfg); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, []);

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
            onEdit={handleEdit}
            onRemoveRequest={setPendingRemoveId}
            onRemoveConfirm={handleRemoveConfirm}
            onRemoveCancel={() => setPendingRemoveId(null)}
          />
        </>
      )}
    </section>
  );
}
