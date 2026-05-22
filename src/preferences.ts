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
  const result: AppPreferences = {};

  if (typeof obj.appearance === "object" && obj.appearance !== null) {
    const ap = obj.appearance as Record<string, unknown>;
    result.appearance = {};
    if (typeof ap.themeMode === "string" && VALID_THEME_MODES.includes(ap.themeMode as ThemeMode)) {
      result.appearance.themeMode = ap.themeMode as ThemeMode;
    } else {
      result.appearance.themeMode = DEFAULT_PREFERENCES.appearance!.themeMode;
    }
    result.appearance.uiFont =
      typeof ap.uiFont === "string" && ap.uiFont.trim().length > 0
        ? ap.uiFont.trim()
        : DEFAULT_PREFERENCES.appearance!.uiFont;
    result.appearance.monoFont =
      typeof ap.monoFont === "string" && ap.monoFont.trim().length > 0
        ? ap.monoFont.trim()
        : DEFAULT_PREFERENCES.appearance!.monoFont;
  } else {
    result.appearance = { ...DEFAULT_PREFERENCES.appearance };
  }

  if (typeof obj.window === "object" && obj.window !== null) {
    const win = obj.window as Record<string, unknown>;
    result.window = {};
    if (typeof win.width === "number" && Number.isFinite(win.width)) result.window.width = win.width;
    if (typeof win.height === "number" && Number.isFinite(win.height)) result.window.height = win.height;
    if (typeof win.x === "number" && Number.isFinite(win.x)) result.window.x = win.x;
    if (typeof win.y === "number" && Number.isFinite(win.y)) result.window.y = win.y;
  }

  return result;
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
