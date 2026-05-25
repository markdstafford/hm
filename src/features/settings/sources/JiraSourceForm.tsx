import { useState, useEffect } from "react";
import type { JiraSourceConfig, SourcesConfig, JiraConnectionTestResult, JiraConnectionProject } from "../../../sources/types";
import { validateJiraDraft, normalizeJiraServerUrl, dedupeAndSortProjects } from "../../../sources/validation";
import { setSourceCredentialSecret, deleteSourceCredential, saveSourcesConfig, testJiraSourceConnection } from "../../../sources/storage";
import { newJiraSourceDraft } from "../../../sources/defaults";
import { Form } from "../../../ui/forms/Form";
import { Button } from "../../../ui/buttons/Button";
import { ConnectionTestStatus } from "./ConnectionTestStatus";
import { ProjectMultiSelect } from "./ProjectMultiSelect";

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
  const [testResult, setTestResult] = useState<JiraConnectionTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [availableProjects, setAvailableProjects] = useState<JiraConnectionProject[]>(
    // Pre-populate from existing saved projects
    existingSource?.projects.map((p) => ({ key: p.key, name: p.name ?? null, id: p.id ?? null })) ?? []
  );

  // Clear PAT on unmount
  useEffect(() => {
    return () => setPendingPat("");
  }, []);

  const errors = validateJiraDraft(draft, pendingPat, mode);
  const canSave = errors.length === 0;

  // Can test if URL is valid (PAT required for new, optional for edit if already saved)
  const canTest = (() => {
    try { normalizeJiraServerUrl(draft.server_url); return true; } catch { return false; }
  })() && (mode === "new" ? pendingPat.trim().length > 0 : true);

  // Projects are selectable after successful test OR if there are already saved projects
  const projectsEnabled = testResult?.status === "Success" || (mode === "edit" && draft.projects.length > 0);

  async function handleTestConnection() {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testJiraSourceConnection(draft, pendingPat.trim() || null);
      setTestResult(result);
      if (result.status === "Success" && result.projects.length > 0) {
        setAvailableProjects(result.projects);
      }
    } catch (e) {
      setTestResult({
        status: "Error",
        tested_at: new Date().toISOString(),
        message: e instanceof Error ? e.message : "Connection test failed.",
        suggested_fix: null,
        projects: [],
        category: "Network",
      });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      let serverUrl = draft.server_url;
      try { serverUrl = normalizeJiraServerUrl(serverUrl); } catch { /* validation already caught */ }

      const now = new Date().toISOString();
      // The credential_ref is stable for a given source id, so we compute it
      // up-front. In create mode `setSourceCredentialSecret` returns the same
      // value; we still write the secret first in create mode (next branch
      // below) so the credential exists when the config references it.
      const stableCredentialRef = draft.auth.credential_ref;

      function buildUpdatedSource(credentialRef: string): JiraSourceConfig {
        return {
          ...draft,
          server_url: serverUrl,
          name:
            draft.name ||
            (() => {
              try { return new URL(serverUrl).hostname; } catch { return serverUrl; }
            })(),
          auth: { type: "Pat", credential_ref: credentialRef },
          projects: dedupeAndSortProjects(draft.projects),
          last_connection_test: testResult
            ? {
                status:
                  testResult.status === "Success"
                    ? "Success"
                    : testResult.status === "Unavailable"
                    ? "Unavailable"
                    : "Error",
                tested_at: testResult.tested_at,
                message: testResult.message,
              }
            : draft.last_connection_test,
          updated_at: now,
          created_at: mode === "new" ? now : draft.created_at,
        };
      }

      function buildUpdatedConfig(updatedSource: JiraSourceConfig): SourcesConfig {
        const updatedSources =
          mode === "new"
            ? [...config.sources, { kind: "Jira" as const, ...updatedSource }]
            : config.sources.map((s) =>
                s.id === updatedSource.id ? { kind: "Jira" as const, ...updatedSource } : s,
              );
        return { ...config, sources: updatedSources };
      }

      if (mode === "new") {
        // Create flow: write the credential first so the config save lands on
        // an existing keychain entry. If the config save fails afterwards,
        // delete the just-created credential to avoid an orphan.
        let credentialRef = stableCredentialRef;
        let newCredentialRef: string | null = null;
        if (pendingPat.trim()) {
          const credResult = await setSourceCredentialSecret(draft.id, "JiraPat", pendingPat);
          if (!credResult.ok) {
            setSaveError(credResult.error);
            return;
          }
          credentialRef = credResult.credentialRef;
          newCredentialRef = credentialRef;
        }
        const updatedConfig = buildUpdatedConfig(buildUpdatedSource(credentialRef));
        const saveResult = await saveSourcesConfig(updatedConfig);
        if (!saveResult.ok) {
          if (newCredentialRef) {
            await deleteSourceCredential(newCredentialRef);
          }
          setSaveError(saveResult.error);
          return;
        }
        setPendingPat("");
        onSaved(updatedConfig);
        return;
      }

      // Edit flow: save the config first. The credential reference is
      // unchanged for an existing source, so the config doesn't need a new
      // keychain entry to land. If config save fails, we never touched the
      // keychain. Only after a successful config save do we attempt the PAT
      // update — if that fails we surface a focused error explaining that
      // metadata is saved but the new PAT could not be stored, which is the
      // less destructive partial-failure state.
      const updatedConfig = buildUpdatedConfig(buildUpdatedSource(stableCredentialRef));
      const saveResult = await saveSourcesConfig(updatedConfig);
      if (!saveResult.ok) {
        setSaveError(saveResult.error);
        return;
      }

      if (pendingPat.trim()) {
        const credResult = await setSourceCredentialSecret(draft.id, "JiraPat", pendingPat);
        if (!credResult.ok) {
          setSaveError(
            `Source metadata saved, but the new PAT could not be stored: ${credResult.error}. Re-enter and save again to update the credential.`,
          );
          // Even with the PAT update failure, the config is persisted — bubble
          // the updated config to the parent so the list refreshes.
          setPendingPat("");
          onSaved(updatedConfig);
          return;
        }
      }

      setPendingPat("");
      onSaved(updatedConfig);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit() {
    if (canSave && !saving) {
      void handleSave();
    }
  }

  return (
    <Form
      onSubmit={handleSubmit}
      aria-label={mode === "new" ? "Add Jira source" : "Edit Jira source"}
    >
      <header>
        <h2 className="text-lg font-semibold text-text">
          {mode === "new" ? "Add Jira source" : `Edit ${existingSource?.name ?? "Jira source"}`}
        </h2>
        <p className="text-sm text-subtext">
          Secrets stay in your OS keychain — never in this form's saved state.
        </p>
      </header>

      <Form.Section label="Connection">
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
              try { setDraft((d) => ({ ...d, server_url: normalizeJiraServerUrl(e.target.value) })); } catch { /* keep */ }
            }}
            placeholder="https://jira.example.com"
            aria-label="Server URL"
            className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-text"
          />
        </div>

        <div>
          <label htmlFor="auth-method" className="block text-sm font-medium text-text mb-1">Auth method</label>
          <select id="auth-method" disabled className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-text opacity-70">
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

        <ConnectionTestStatus result={testResult} isTesting={isTesting} />
      </Form.Section>

      {projectsEnabled && (
        <Form.Section label="Projects">
          <ProjectMultiSelect
            availableProjects={availableProjects}
            selectedProjects={draft.projects}
            disabled={!projectsEnabled}
            onChange={(selected) => setDraft((d) => ({ ...d, projects: selected }))}
          />
        </Form.Section>
      )}

      {saveError && <Form.Error>{saveError}</Form.Error>}

      <Form.Actions>
        <Button
          type="button"
          variant="secondary"
          onClick={handleTestConnection}
          disabled={!canTest || isTesting}
        >
          {isTesting ? "Testing…" : "Test connection"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => { setPendingPat(""); onCancel(); }}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!canSave || saving}>
          {mode === "new" ? "Add source" : "Save changes"}
        </Button>
      </Form.Actions>
    </Form>
  );
}
