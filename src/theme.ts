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

export type ThemeCatalogEntry = {
  id: ThemeId;
  label: string;
  brightness: "light" | "dark";
  family: string;
  features: string[];
};

export const THEME_CATALOG: ThemeCatalogEntry[] = [
  {
    id: "catppuccin-latte",
    label: "Catppuccin Latte",
    brightness: "light",
    family: "catppuccin",
    features: ["catppuccinAccent"],
  },
  {
    id: "catppuccin-frappe",
    label: "Catppuccin Frappé",
    brightness: "dark",
    family: "catppuccin",
    features: ["catppuccinAccent"],
  },
  {
    id: "catppuccin-macchiato",
    label: "Catppuccin Macchiato",
    brightness: "dark",
    family: "catppuccin",
    features: ["catppuccinAccent"],
  },
  {
    id: "catppuccin-mocha",
    label: "Catppuccin Mocha",
    brightness: "dark",
    family: "catppuccin",
    features: ["catppuccinAccent"],
  },
  {
    id: "github-light",
    label: "GitHub Light",
    brightness: "light",
    family: "github",
    features: [],
  },
  {
    id: "github-dark",
    label: "GitHub Dark",
    brightness: "dark",
    family: "github",
    features: [],
  },
  {
    id: "solarized-light",
    label: "Solarized Light",
    brightness: "light",
    family: "solarized",
    features: [],
  },
  {
    id: "dracula",
    label: "Dracula",
    brightness: "dark",
    family: "dracula",
    features: [],
  },
];

export const CATPPUCCIN_ACCENTS: CatppuccinAccent[] = [
  "rosewater",
  "flamingo",
  "pink",
  "mauve",
  "red",
  "maroon",
  "peach",
  "yellow",
  "green",
  "teal",
  "sky",
  "sapphire",
  "blue",
  "lavender",
];

export const VALID_THEME_IDS = THEME_CATALOG.map((t) => t.id);
export const LIGHT_THEMES = THEME_CATALOG.filter((t) => t.brightness === "light");
export const DARK_THEMES = THEME_CATALOG.filter((t) => t.brightness === "dark");

export function isLightTheme(id: unknown): id is ThemeId {
  return typeof id === "string" && LIGHT_THEMES.some((t) => t.id === id);
}

export function isDarkTheme(id: unknown): id is ThemeId {
  return typeof id === "string" && DARK_THEMES.some((t) => t.id === id);
}

export function getThemeMeta(id: ThemeId): ThemeCatalogEntry | undefined {
  return THEME_CATALOG.find((t) => t.id === id);
}

export function themeSupportsFeature(id: ThemeId, feature: string): boolean {
  return getThemeMeta(id)?.features.includes(feature) ?? false;
}

export type ResolvedColorScheme = {
  themeId: ThemeId;
  brightness: "light" | "dark";
  accent?: CatppuccinAccent;
};

export function applyColorScheme(input: ResolvedColorScheme): void {
  const root = document.documentElement;
  root.dataset.theme = input.themeId;
  root.dataset.themeMode = input.brightness;

  if (input.accent) {
    root.dataset.accent = input.accent;
    root.style.setProperty("--hm-accent", `var(--ctp-${input.accent})`);
  } else {
    delete root.dataset.accent;
    root.style.removeProperty("--hm-accent");
  }
}

export function getSystemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function applyFonts(uiFont: string, monoFont: string): void {
  const root = document.documentElement;
  root.style.setProperty(
    "--font-sans",
    `"${uiFont}", ui-sans-serif, system-ui, sans-serif`
  );
  root.style.setProperty(
    "--font-mono",
    `"${monoFont}", ui-monospace, monospace`
  );
}

// Legacy export - uses new full theme IDs. Remove after App.tsx migration in Task C.
export function applyTheme(mode: "system" | "light" | "dark", prefersDark: boolean): void {
  const root = document.documentElement;
  if (mode === "light") {
    root.dataset.theme = "catppuccin-latte";
    root.dataset.themeMode = "light";
  } else if (mode === "dark") {
    root.dataset.theme = "catppuccin-macchiato";
    root.dataset.themeMode = "dark";
  } else {
    root.dataset.theme = prefersDark ? "catppuccin-macchiato" : "catppuccin-latte";
    root.dataset.themeMode = prefersDark ? "dark" : "light";
  }
}
