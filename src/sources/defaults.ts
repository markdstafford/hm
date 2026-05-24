import type { SourcesConfig, JiraSourceConfig } from "./types";

export const EMPTY_SOURCES_CONFIG: SourcesConfig = { version: 1, sources: [] };

export const JIRA_UNAVAILABLE_MESSAGE =
  "Live connection testing depends on issue #9. The source can be saved, but projects must wait for the Jira API client.";

export function newJiraSourceDraft(now = new Date()): JiraSourceConfig {
  const id = generateSourceId();
  return {
    id,
    name: "",
    enabled: true,
    server_url: "",
    auth: { type: "Pat", credential_ref: `source.jira.${id}.pat` },
    projects: [],
    last_connection_test: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

function generateSourceId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    // Use a prefix for readability and remove hyphens
    return "src_" + globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  }
  // Fallback for environments without crypto.randomUUID
  return "src_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
