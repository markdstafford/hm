import { commands } from "../bindings";
import { EMPTY_AI_PROVIDER_CONFIG } from "./defaults";
import { validateAiProviderConfig } from "./validation";
import type { AiProviderConfig, AiSmokeTestResult, SmokeTestResult } from "./types";

// Re-export for convenience
export type { AiSmokeTestResult };

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function loadAiProviderConfig(): Promise<AiProviderConfig> {
  if (!isTauri()) return structuredClone(EMPTY_AI_PROVIDER_CONFIG);
  const r = await commands.aiProviderConfigGet();
  if (r.status === "error") throw new Error(r.error);
  return r.data;
}

export async function saveAiProviderConfig(
  config: AiProviderConfig
): Promise<{ ok: true } | { ok: false; error: string }> {
  const errors = validateAiProviderConfig(config);
  if (errors.length) return { ok: false, error: errors.join("\n") };
  if (!isTauri()) return { ok: true };
  const r = await commands.aiProviderConfigSave(config);
  return r.status === "ok" ? { ok: true } : { ok: false, error: r.error };
}

export async function setAiCredentialSecret(
  credentialName: string,
  value: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isTauri()) return { ok: true };
  const r = await commands.aiCredentialSecretSet(credentialName, value);
  return r.status === "ok" ? { ok: true } : { ok: false, error: r.error };
}

export async function deleteAiCredentialSecret(
  credentialName: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isTauri()) return { ok: true };
  const r = await commands.aiCredentialSecretDelete(credentialName);
  return r.status === "ok" ? { ok: true } : { ok: false, error: r.error };
}

export async function smokeTestAiProfile(
  profileName: string
): Promise<SmokeTestResult> {
  if (!isTauri()) {
    return {
      status: "Error",
      profile: profileName,
      runner: "OpenAiChatCompletions",
      execution_mode: "DirectApi",
      model: "",
      elapsed_ms: 0,
      preview: null,
      error: "Smoke tests require the Tauri runtime.",
      suggested_fix: "Run inside the desktop app.",
    };
  }
  const r = await commands.aiProfileSmokeTest(profileName);
  if (r.status === "error") throw new Error(r.error);
  return r.data;
}
