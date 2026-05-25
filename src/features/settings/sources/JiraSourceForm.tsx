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
      let credentialRef = draft.auth.credential_ref;
      // Track whether we created a new credential that needs rollback if save fails.
      // Edit mode overwrites the same ref (source still references it), so only new sources need cleanup.
      let newCredentialRef: string | null = null;

      if (pendingPat.trim()) {
        const credResult = await setSourceCredentialSecret(draft.id, "JiraPat", pendingPat);
        if (!credResult.ok) {
          setSaveError(credResult.error);
          return;
        }
        credentialRef = credResult.credentialRef;
        if (mode === "new") {
          newCredentialRef = credentialRef;
        }
      }

      let serverUrl = draft.server_url;
      try { serverUrl = normalizeJiraServerUrl(serverUrl); } catch { /* validation already caught */ }

      const now = new Date().toISOString();
      const updatedSource: JiraSourceConfig = {
        ...draft,
        server_url: serverUrl,
        name: draft.name || (() => { try { return new URL(serverUrl).hostname; } catch { return serverUrl; } })(),
        auth: { type: "Pat", credential_ref: credentialRef },
        projects: dedupeAndSortProjects(draft.projects),
        last_connection_test: testResult
          ? { status: testResult.status === "Success" ? "Success" : testResult.status === "Unavailable" ? "Unavailable" : "Error", tested_at: testResult.tested_at, message: testResult.message }
          : draft.last_connection_test,
        updated_at: now,
        created_at: mode === "new" ? now : draft.created_at,
      };

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
        // Roll back the newly written credential for new sources to avoid an orphaned keychain entry.
        if (newCredentialRef) {
          await deleteSourceCredential(newCredentialRef);
        }
        setSaveError(saveResult.error);
        return;
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
