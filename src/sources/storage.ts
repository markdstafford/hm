import { commands } from "../bindings";
import { EMPTY_SOURCES_CONFIG, JIRA_UNAVAILABLE_MESSAGE } from "./defaults";
import type {
  SourcesConfig,
  JiraSourceConfig,
  SourceCredentialKind,
  JiraConnectionTestResult,
} from "./types";

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function loadSourcesConfig(): Promise<SourcesConfig> {
  if (!isTauri()) return structuredClone(EMPTY_SOURCES_CONFIG);
  const r = await commands.sourceConfigGet();
  if (r.status === "error") throw new Error(r.error);
  return r.data;
}

export async function saveSourcesConfig(
  config: SourcesConfig
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isTauri()) return { ok: true };
  const r = await commands.sourceConfigSave(config);
  return r.status === "ok" ? { ok: true } : { ok: false, error: r.error };
}

export async function setSourceCredentialSecret(
  sourceId: string,
  kind: SourceCredentialKind,
  value: string
): Promise<{ ok: true; credentialRef: string } | { ok: false; error: string }> {
  if (!isTauri()) {
    return { ok: true, credentialRef: `source.jira.${sourceId}.pat` };
  }
  const r = await commands.sourceCredentialSecretSet(sourceId, kind, value);
  return r.status === "ok"
    ? { ok: true, credentialRef: r.data }
    : { ok: false, error: r.error };
}

export async function deleteSourceCredential(
  credentialRef: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isTauri()) return { ok: true };
  const r = await commands.sourceCredentialDelete(credentialRef);
  return r.status === "ok" ? { ok: true } : { ok: false, error: r.error };
}

export async function removeSource(
  sourceId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isTauri()) return { ok: true };
  const r = await commands.sourceConfigRemove(sourceId);
  return r.status === "ok" ? { ok: true } : { ok: false, error: r.error };
}

export async function testJiraSourceConnection(
  source: JiraSourceConfig,
  pendingPat: string | null
): Promise<JiraConnectionTestResult> {
  if (!isTauri()) {
    return {
      status: "Unavailable",
      tested_at: new Date().toISOString(),
      message: JIRA_UNAVAILABLE_MESSAGE,
      suggested_fix: null,
      projects: [],
      category: "Unavailable",
    };
  }
  const r = await commands.jiraSourceTestConnection(source, pendingPat);
  if (r.status === "error") throw new Error(r.error);
  return r.data;
}
