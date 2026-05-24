import { useState, useEffect } from "react";
import type { JiraSourceConfig, SourcesConfig } from "../../sources/types";
import { validateJiraDraft, normalizeJiraServerUrl } from "../../sources/validation";
import { setSourceCredentialSecret, saveSourcesConfig } from "../../sources/storage";
import { newJiraSourceDraft } from "../../sources/defaults";

interface JiraSourceFormProps {
  mode: "new" | "edit";
  existingSource?: JiraSourceConfig;
  config: SourcesConfig;
  onSaved: (updatedConfig: SourcesConfig) => void;
  onCancel: () => void;
}

export function JiraSourceForm({ mode, existingSource, config, onSaved, onCancel }: JiraSourceFormProps) {
  const [draft, setDraft] = useState<JiraSourceConfig>(
    () => existingSource ? { ...existingSource } : newJiraSourceDraft()
  );
  const [pendingPat, setPendingPat] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Clear PAT on unmount
  useEffect(() => {
    return () => setPendingPat("");
  }, []);

  const errors = validateJiraDraft(draft, pendingPat, mode);
  const canSave = errors.length === 0;

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      let credentialRef = draft.auth.credential_ref;

      // Store PAT in keychain if provided
      if (pendingPat.trim()) {
        const credResult = await setSourceCredentialSecret(draft.id, "JiraPat", pendingPat);
        if (!credResult.ok) {
          setSaveError(credResult.error);
          return;
        }
        credentialRef = credResult.credentialRef;
      }

      // Normalize URL
      let serverUrl = draft.server_url;
      try {
        serverUrl = normalizeJiraServerUrl(serverUrl);
      } catch {
        // validation already caught this
      }

      const now = new Date().toISOString();
      const updatedSource: JiraSourceConfig = {
        ...draft,
        server_url: serverUrl,
        name: draft.name || new URL(serverUrl).hostname,
        auth: { type: "Pat", credential_ref: credentialRef },
        updated_at: now,
        created_at: mode === "new" ? now : draft.created_at,
      };

      // Build updated config
      let updatedSources;
      if (mode === "new") {
        updatedSources = [...config.sources, { kind: "Jira" as const, ...updatedSource }];
      } else {
        updatedSources = config.sources.map((s) =>
          s.id === updatedSource.id ? { kind: "Jira" as const, ...updatedSource } : s
        );
      }
      const updatedConfig: SourcesConfig = { ...config, sources: updatedSources };

      const saveResult = await saveSourcesConfig(updatedConfig);
      if (!saveResult.ok) {
        setSaveError(saveResult.error);
        return;
      }

      // Clear PAT after successful save
      setPendingPat("");
      onSaved(updatedConfig);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="jira-form-heading" className="space-y-4">
      <h2 id="jira-form-heading" className="text-lg font-semibold text-text">
        {mode === "new" ? "Add Jira source" : "Edit Jira source"}
      </h2>

      <div className="space-y-3">
        <div>
          <label htmlFor="source-name" className="block text-sm font-medium text-text mb-1">
            Source name <span className="text-subtext font-normal">(optional)</span>
          </label>
          <input
            id="source-name"
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Defaults to server hostname"
            className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-text"
          />
        </div>

        <div>
          <label htmlFor="server-url" className="block text-sm font-medium text-text mb-1">
            Server URL <span className="text-red">*</span>
          </label>
          <input
            id="server-url"
            type="url"
            value={draft.server_url}
            onChange={(e) => setDraft((d) => ({ ...d, server_url: e.target.value }))}
            onBlur={(e) => {
              try {
                setDraft((d) => ({ ...d, server_url: normalizeJiraServerUrl(e.target.value) }));
              } catch {
                // keep as-is; validation will surface the error
              }
            }}
            placeholder="https://jira.example.com"
            aria-label="Server URL"
            className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-text"
          />
        </div>

        <div>
          <label htmlFor="auth-method" className="block text-sm font-medium text-text mb-1">
            Auth method
          </label>
          <select
            id="auth-method"
            disabled
            className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-text opacity-70"
          >
            <option>Personal access token (PAT)</option>
          </select>
        </div>

        <div>
          <label htmlFor="pat" className="block text-sm font-medium text-text mb-1">
            Personal access token{mode === "new" ? <span className="text-red"> *</span> : " (leave blank to keep existing)"}
          </label>
          <input
            id="pat"
            type="password"
            value={pendingPat}
            onChange={(e) => setPendingPat(e.target.value)}
            placeholder={mode === "edit" ? "Leave blank to keep existing token" : "Paste your PAT here"}
            aria-label="Personal access token"
            autoComplete="off"
            className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-text"
          />
          <p className="text-xs text-subtext mt-1">
            The token is stored in your OS keychain. Server URL and project choices are stored in hm's local database.
          </p>
        </div>
      </div>

      {saveError && <p className="text-sm text-red">{saveError}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || saving}
          className="px-3 py-1.5 rounded bg-blue text-crust text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPendingPat("");
            onCancel();
          }}
          className="px-3 py-1.5 rounded text-sm font-medium text-subtext hover:text-text"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
