import { commands } from "../bindings";
import {
  type AppPreferences,
  normalizePreferences,
  mergePreferences,
  resolvedPreferences,
  DEFAULT_PREFERENCES,
} from "../preferences";

const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function loadPreferences(): Promise<AppPreferences> {
  if (!isTauri()) return { ...DEFAULT_PREFERENCES };
  try {
    const result = await commands.preferencesRead();
    if (result.status === "error") {
      console.warn("[settings] preferencesRead error:", result.error);
      return { ...DEFAULT_PREFERENCES };
    }
    return resolvedPreferences(normalizePreferences(result.data));
  } catch (err) {
    console.warn("[settings] preferencesRead threw:", err);
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function savePreferences(
  current: AppPreferences,
  patch: Partial<AppPreferences>
): Promise<{ ok: true; next: AppPreferences } | { ok: false; next: AppPreferences; error: string }> {
  const next = mergePreferences(current, patch);
  if (!isTauri()) return { ok: true, next };
  try {
    const result = await commands.preferencesWrite(next as unknown);
    if (result.status === "error") {
      return { ok: false, next, error: result.error };
    }
    return { ok: true, next };
  } catch (err) {
    return { ok: false, next, error: String(err) };
  }
}
