export type ThemeMode = "system" | "light" | "dark";

export type AppPreferences = {
  appearance?: {
    themeMode?: ThemeMode;
    uiFont?: string;
    monoFont?: string;
  };
  window?: {
    width?: number;
    height?: number;
    x?: number;
    y?: number;
  };
};

export const DEFAULT_PREFERENCES: AppPreferences = {
  appearance: {
    themeMode: "system",
    uiFont: "Inter Variable",
    monoFont: "Fira Code",
  },
};

const VALID_THEME_MODES: ThemeMode[] = ["system", "light", "dark"];

export function normalizePreferences(raw: unknown): AppPreferences {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_PREFERENCES };

  const obj = raw as Record<string, unknown>;
  // Start with all original keys so unknown top-level fields are preserved when
  // the preferences object is written back out.
  const result: Record<string, unknown> = { ...obj };

  if (typeof obj.appearance === "object" && obj.appearance !== null) {
    const ap = obj.appearance as Record<string, unknown>;
    // Preserve unknown appearance keys, then overwrite known fields with validated values.
    const appearance: Record<string, unknown> = { ...ap };
    appearance.themeMode =
      typeof ap.themeMode === "string" && VALID_THEME_MODES.includes(ap.themeMode as ThemeMode)
        ? ap.themeMode
        : DEFAULT_PREFERENCES.appearance!.themeMode;
    appearance.uiFont =
      typeof ap.uiFont === "string" && ap.uiFont.trim().length > 0
        ? ap.uiFont.trim()
        : DEFAULT_PREFERENCES.appearance!.uiFont;
    appearance.monoFont =
      typeof ap.monoFont === "string" && ap.monoFont.trim().length > 0
        ? ap.monoFont.trim()
        : DEFAULT_PREFERENCES.appearance!.monoFont;
    result.appearance = appearance;
  } else {
    result.appearance = { ...DEFAULT_PREFERENCES.appearance };
  }

  if (typeof obj.window === "object" && obj.window !== null) {
    const win = obj.window as Record<string, unknown>;
    // Preserve unknown window keys; remove invalid known numeric fields.
    const window_: Record<string, unknown> = { ...win };
    if (!(typeof win.width === "number" && Number.isFinite(win.width))) delete window_.width;
    if (!(typeof win.height === "number" && Number.isFinite(win.height))) delete window_.height;
    if (!(typeof win.x === "number" && Number.isFinite(win.x))) delete window_.x;
    if (!(typeof win.y === "number" && Number.isFinite(win.y))) delete window_.y;
    result.window = window_;
  } else {
    delete result.window;
  }

  return result as unknown as AppPreferences;
}

export function mergePreferences(current: AppPreferences, patch: Partial<AppPreferences>): AppPreferences {
  return {
    ...current,
    appearance: {
      ...current.appearance,
      ...patch.appearance,
    },
    window: {
      ...current.window,
      ...patch.window,
    },
  };
}

export function resolvedPreferences(saved: AppPreferences): AppPreferences {
  return mergePreferences(DEFAULT_PREFERENCES, saved);
}
