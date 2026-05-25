import type { AiProviderConfig } from "./types";

const NAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const TASK_SEGMENT_PATTERN = /^[a-z0-9_-]+$/;
const ENV_VAR_PATTERN = /^[A-Z0-9_]+$/;
const SECRET_SHAPED_KEYS = ["api_key", "token", "secret", "authorization", "password"];

export function validateAiProviderConfig(config: AiProviderConfig): string[] {
  const errors: string[] = [];

  // Unique names within each layer
  checkDuplicates(config.credentials.map(c => c.name), "credential", errors);
  checkDuplicates(config.endpoints.map(e => e.name), "endpoint", errors);
  checkDuplicates(config.profiles.map(p => p.name), "profile", errors);

  // Validate names + credential source contents
  for (const c of config.credentials) {
    if (!isValidName(c.name)) errors.push(`Invalid credential name: ${c.name}`);
    // Mirror src-tauri/src/ai/config.rs::validate(): keychain key_ref must
    // equal `ai.credentials.<name>` so the backend never has to guess where
    // a credential's secret lives, and env var names must be POSIX-shape.
    if (c.source.type === "Keychain") {
      const expected = `ai.credentials.${c.name}`;
      if (c.source.key_ref !== expected) {
        errors.push(
          `Credential "${c.name}" keychain key_ref must be ${expected} but got ${c.source.key_ref}`,
        );
      }
    } else if (c.source.type === "Env") {
      if (!c.source.var_name) {
        errors.push(`Credential "${c.name}" env var name must not be empty`);
      } else if (!ENV_VAR_PATTERN.test(c.source.var_name)) {
        errors.push(
          `Credential "${c.name}" env var name may only contain [A-Z0-9_]: ${c.source.var_name}`,
        );
      }
    }
  }
  for (const e of config.endpoints) {
    if (!isValidName(e.name)) errors.push(`Invalid endpoint name: ${e.name}`);
    if (!isValidUrl(e.base_url)) errors.push(`Invalid endpoint URL: ${e.name}`);
    const credExists = config.credentials.some(c => c.name === e.credential_ref);
    if (!credExists) errors.push(`Missing credential reference: ${e.credential_ref}`);
  }
  for (const p of config.profiles) {
    if (!isValidName(p.name)) errors.push(`Invalid profile name: ${p.name}`);
    const endpointExists = config.endpoints.some(e => e.name === p.endpoint_ref);
    if (!endpointExists) errors.push(`Missing endpoint reference: ${p.endpoint_ref}`);

    // Check supported protocol/runner/execution-mode combo
    const endpoint = config.endpoints.find(e => e.name === p.endpoint_ref);
    if (endpoint) {
      if (!isSupportedCombo(endpoint.protocol, p.runner, p.execution_mode)) {
        errors.push(`Unsupported protocol/runner/execution-mode combination: ${p.name}`);
      }
    }

    // Check settings for secret-shaped keys
    if (p.settings && typeof p.settings === "object") {
      checkSettingsForSecrets(p.settings as Record<string, unknown>, errors);
    }
  }
  for (const [taskName, profileName] of Object.entries(config.routing)) {
    if (!isValidTaskName(taskName)) errors.push(`Invalid task name: ${taskName}`);
    const profileExists = config.profiles.some(p => p.name === profileName);
    if (!profileExists) errors.push(`Missing profile reference: ${profileName}`);
  }

  return errors;
}

function checkDuplicates(names: string[], layer: string, errors: string[]) {
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) errors.push(`Duplicate ${layer} name: ${name}`);
    seen.add(name);
  }
}

function isValidName(name: string): boolean {
  return name.length >= 1 && name.length <= 128 && NAME_PATTERN.test(name) && name === name.trim();
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Match src-tauri/src/ai/config.rs::validate_url(): http/https, non-empty
    // host, and explicitly no query string or fragment. The Rust side rejects
    // both, so accepting them here would let "saved" configs fail only when
    // the user is online inside Tauri.
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.hostname.length > 0 &&
      parsed.search === "" &&
      parsed.hash === ""
    );
  } catch {
    return false;
  }
}

function isValidTaskName(name: string): boolean {
  const segments = name.split(".");
  return segments.length >= 2 && segments.every(s => s.length > 0 && TASK_SEGMENT_PATTERN.test(s));
}

function isSupportedCombo(protocol: string, runner: string, executionMode: string): boolean {
  return (
    (protocol === "AnthropicMessages" && runner === "AnthropicMessages" && executionMode === "DirectApi") ||
    (protocol === "OpenAiChatCompletionsCompatible" && runner === "OpenAiChatCompletions" && executionMode === "DirectApi")
  );
}

function checkSettingsForSecrets(obj: Record<string, unknown>, errors: string[]) {
  for (const [key, value] of Object.entries(obj)) {
    if (SECRET_SHAPED_KEYS.some(sk => key.toLowerCase().includes(sk))) {
      errors.push(`Secret-shaped settings key: ${key}`);
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      checkSettingsForSecrets(value as Record<string, unknown>, errors);
    }
  }
}
