import {
  isLightTheme,
  isDarkTheme,
  CATPPUCCIN_ACCENTS,
} from "../theme";

export type ThemeMode = "system" | "light" | "dark";
export type ThemeBrightness = "light" | "dark";
export type ThemeId = string;
export type CatppuccinAccent =
  | "rosewater"
  | "flamingo"
  | "pink"
  | "mauve"
  | "red"
  | "maroon"
  | "peach"
  | "yellow"
  | "green"
  | "teal"
  | "sky"
  | "sapphire"
  | "blue"
  | "lavender";

export type AppPreferences = {
  appearance?: {
    themeMode?: ThemeMode;
    lightTheme?: ThemeId;
    darkTheme?: ThemeId;
    themeFeatures?: {
      catppuccin?: {
        accent?: CatppuccinAccent;
      };
      [themeFamily: string]: unknown;
    };
    /** Deprecated compatibility field from earlier Catppuccin-only drafts/prototypes. */
    flavor?: "latte" | "frappe" | "macchiato" | "mocha";
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
    lightTheme: "catppuccin-latte",
    darkTheme: "catppuccin-macchiato",
    themeFeatures: {
      catppuccin: { accent: "sapphire" },
    },
    uiFont: "Inter Variable",
    monoFont: "Fira Code",
  },
};

const VALID_THEME_MODES: ThemeMode[] = ["system", "light", "dark"];
const DEPRECATED_DARK_FLAVORS: Record<string, ThemeId> = {
  frappe: "catppuccin-frappe",
  macchiato: "catppuccin-macchiato",
  mocha: "catppuccin-mocha",
};

export function normalizePreferences(raw: unknown): AppPreferences {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_PREFERENCES };

  const obj = raw as Record<string, unknown>;
  const result: Record<string, unknown> = { ...obj };

  if (typeof obj.appearance === "object" && obj.appearance !== null) {
    const ap = obj.appearance as Record<string, unknown>;
    const appearance: Record<string, unknown> = { ...ap };

    // themeMode
    appearance.themeMode =
      typeof ap.themeMode === "string" && VALID_THEME_MODES.includes(ap.themeMode as ThemeMode)
        ? ap.themeMode
        : DEFAULT_PREFERENCES.appearance!.themeMode;

    // Handle deprecated flavor migration (only if explicit slots not already set)
    const flavor = typeof ap.flavor === "string" ? ap.flavor : null;

    // lightTheme
    if (isLightTheme(ap.lightTheme)) {
      appearance.lightTheme = ap.lightTheme;
    } else if (flavor === "latte" && !ap.lightTheme) {
      appearance.lightTheme = "catppuccin-latte";
    } else {
      appearance.lightTheme = DEFAULT_PREFERENCES.appearance!.lightTheme;
    }

    // darkTheme
    if (isDarkTheme(ap.darkTheme)) {
      appearance.darkTheme = ap.darkTheme;
    } else if (flavor && flavor !== "latte" && DEPRECATED_DARK_FLAVORS[flavor] && !ap.darkTheme) {
      appearance.darkTheme = DEPRECATED_DARK_FLAVORS[flavor];
    } else {
      appearance.darkTheme = DEFAULT_PREFERENCES.appearance!.darkTheme;
    }

    // themeFeatures
    if (typeof ap.themeFeatures === "object" && ap.themeFeatures !== null) {
      const tf = ap.themeFeatures as Record<string, unknown>;
      const features: Record<string, unknown> = { ...tf };
      if (typeof tf.catppuccin === "object" && tf.catppuccin !== null) {
        const ctp = tf.catppuccin as Record<string, unknown>;
        const accent = typeof ctp.accent === "string" && (CATPPUCCIN_ACCENTS as readonly string[]).includes(ctp.accent)
          ? (ctp.accent as CatppuccinAccent)
          : "sapphire";
        features.catppuccin = { ...ctp, accent };
      } else {
        features.catppuccin = { accent: "sapphire" };
      }
      appearance.themeFeatures = features;
    } else {
      appearance.themeFeatures = { catppuccin: { accent: "sapphire" } };
    }

    // fonts
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
      ...(patch.appearance ? {
        ...patch.appearance,
        themeFeatures: patch.appearance.themeFeatures !== undefined
          ? { ...current.appearance?.themeFeatures, ...patch.appearance.themeFeatures }
          : current.appearance?.themeFeatures,
      } : {}),
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

export function resolveThemeSlots(prefs: AppPreferences): {
  lightTheme: ThemeId;
  darkTheme: ThemeId;
} {
  return {
    lightTheme: isLightTheme(prefs.appearance?.lightTheme)
      ? prefs.appearance!.lightTheme!
      : "catppuccin-latte",
    darkTheme: isDarkTheme(prefs.appearance?.darkTheme)
      ? prefs.appearance!.darkTheme!
      : "catppuccin-macchiato",
  };
}

export function resolveTheme(
  prefs: AppPreferences,
  prefersDark: boolean,
): { themeId: ThemeId; brightness: "light" | "dark" } {
  const mode: ThemeMode =
    typeof prefs.appearance?.themeMode === "string" &&
    VALID_THEME_MODES.includes(prefs.appearance.themeMode as ThemeMode)
      ? (prefs.appearance.themeMode as ThemeMode)
      : "system";
  const { lightTheme, darkTheme } = resolveThemeSlots(prefs);
  if (mode === "light") return { themeId: lightTheme, brightness: "light" };
  if (mode === "dark") return { themeId: darkTheme, brightness: "dark" };
  return prefersDark
    ? { themeId: darkTheme, brightness: "dark" }
    : { themeId: lightTheme, brightness: "light" };
}

export function resolveCatppuccinAccent(prefs: AppPreferences): CatppuccinAccent {
  const saved = prefs.appearance?.themeFeatures?.catppuccin?.accent;
  if (typeof saved === "string" && (CATPPUCCIN_ACCENTS as readonly string[]).includes(saved)) {
    return saved as CatppuccinAccent;
  }
  return "sapphire";
}
