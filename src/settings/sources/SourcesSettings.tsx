import { useEffect, useState } from "react";
import { loadSourcesConfig, removeSource } from "../../sources/storage";
import type { SourcesConfig } from "../../sources/types";
import { SourceList } from "./SourceList";

type Mode = "list" | "add" | "edit";

export function SourcesSettings() {
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
    setMode("edit");
  }

  // Editing a source — show a placeholder (edit form comes in Task 9)
  if (mode === "edit" && editingSourceId) {
    const source = config.sources.find((s) => s.id === editingSourceId);
    return (
      <section aria-labelledby="sources-heading" className="space-y-6">
        <h1 id="sources-heading" className="text-2xl font-semibold text-text">Edit Source</h1>
        {/* Minimal shell for Task 8 — full form in Task 9 */}
        <div>
          <label htmlFor="server-url-edit" className="block text-sm font-medium text-text mb-1">Server URL</label>
          <input
            id="server-url-edit"
            type="url"
            defaultValue={source?.server_url ?? ""}
            className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-text"
          />
          <label htmlFor="pat-edit" className="block text-sm font-medium text-text mb-1 mt-3">Personal access token</label>
          <input
            id="pat-edit"
            type="password"
            defaultValue=""
            placeholder="Leave blank to keep existing token"
            aria-label="Personal access token"
            className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-text"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode("list")} className="px-3 py-1.5 rounded text-sm font-medium text-subtext hover:text-text">
            Cancel
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="sources-heading" className="space-y-6">
      <div>
        <h1 id="sources-heading" className="text-2xl font-semibold text-text">Sources</h1>
        <p className="text-sm text-subtext mt-1">
          Configure the systems hm reads from. Secrets are stored in the OS keychain.
        </p>
      </div>
      {error && <p className="text-sm text-red">{error}</p>}
      {!loading && (
        <>
          <button
            type="button"
            onClick={() => setMode("add")}
            className="rounded bg-blue px-3 py-1.5 text-sm font-medium text-crust"
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
