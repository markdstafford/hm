import type { JiraSourceConfig, JiraProjectFilter } from "./types";

const SECRET_KEYWORDS = ["token", "secret", "password", "authorization", "api_key", "api-key"];
const SECRET_EXACT = ["pat"];

export function containsSecretShapedKey(obj: unknown): boolean {
  if (typeof obj !== "object" || obj === null) return false;
  for (const [key, value] of Object.entries(obj)) {
    const lower = key.toLowerCase();
    if (SECRET_EXACT.includes(lower)) return true;
    if (SECRET_KEYWORDS.some((kw) => lower.includes(kw))) return true;
    if (typeof value === "object" && value !== null && containsSecretShapedKey(value)) return true;
  }
  return false;
}

export function normalizeJiraServerUrl(input: string): string {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`Invalid Jira server URL: ${trimmed}`);
  }

  if (url.protocol === "http:") {
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      throw new Error(
        `Jira server URL must use https (http is only allowed for localhost/127.0.0.1): ${trimmed}`
      );
    }
  } else if (url.protocol !== "https:") {
    throw new Error(`Jira server URL must use https scheme: ${trimmed}`);
  }

  if (url.username || url.password) {
    throw new Error(`Jira server URL must not contain credentials: ${trimmed}`);
  }
  if (url.search) {
    throw new Error(`Jira server URL must not include a query string: ${trimmed}`);
  }
  if (url.hash) {
    throw new Error(`Jira server URL must not include a fragment: ${trimmed}`);
  }

  // Reconstruct without trailing slash
  let result = `${url.protocol}//${url.host}`;
  const path = url.pathname.replace(/\/+$/, "");
  if (path && path !== "/") result += path;
  return result;
}

export function validateJiraDraft(
  draft: Partial<JiraSourceConfig>,
  pendingPat: string,
  mode: "new" | "edit"
): string[] {
  const errors: string[] = [];

  if (!draft.server_url?.trim()) {
    errors.push("Server URL is required.");
  } else {
    try {
      normalizeJiraServerUrl(draft.server_url);
    } catch (e: unknown) {
      errors.push(e instanceof Error ? e.message : "Invalid server URL.");
    }
  }

  if (mode === "new" && !pendingPat.trim()) {
    errors.push("Personal access token is required.");
  }

  return errors;
}

export function dedupeAndSortProjects(projects: JiraProjectFilter[]): JiraProjectFilter[] {
  const seen = new Set<string>();
  return projects
    .filter((p) => {
      if (!p.key || seen.has(p.key)) return false;
      seen.add(p.key);
      return true;
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}
