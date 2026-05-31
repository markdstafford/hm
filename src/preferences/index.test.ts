import { describe, it, expect } from "vitest";
import {
  normalizePreferences,
  mergePreferences,
  resolvedPreferences,
  DEFAULT_PREFERENCES,
  resolveThemeSlots,
  resolveTheme,
  resolveCatppuccinAccent,
  resolveAppearanceAccents,
} from "./index";

describe("normalizePreferences", () => {
  it("returns defaults for null input", () => {
    const result = normalizePreferences(null);
    expect(result.appearance?.themeMode).toBe("system");
    expect(result.appearance?.uiFont).toBe("Inter Variable");
    expect(result.appearance?.monoFont).toBe("Fira Code");
  });

  it("returns defaults for non-object input", () => {
    const result = normalizePreferences("bad");
    expect(result.appearance?.themeMode).toBe("system");
  });

  it("accepts valid themeMode values", () => {
    expect(normalizePreferences({ appearance: { themeMode: "light" } }).appearance?.themeMode).toBe("light");
    expect(normalizePreferences({ appearance: { themeMode: "dark" } }).appearance?.themeMode).toBe("dark");
    expect(normalizePreferences({ appearance: { themeMode: "system" } }).appearance?.themeMode).toBe("system");
  });

  it("falls back to system for invalid themeMode", () => {
    const result = normalizePreferences({ appearance: { themeMode: "rainbow" } });
    expect(result.appearance?.themeMode).toBe("system");
  });

  it("preserves valid font strings", () => {
    const result = normalizePreferences({ appearance: { uiFont: "Roboto", monoFont: "JetBrains Mono" } });
    expect(result.appearance?.uiFont).toBe("Roboto");
    expect(result.appearance?.monoFont).toBe("JetBrains Mono");
  });

  it("falls back to defaults for empty font strings", () => {
    const result = normalizePreferences({ appearance: { uiFont: "   ", monoFont: "" } });
    expect(result.appearance?.uiFont).toBe("Inter Variable");
    expect(result.appearance?.monoFont).toBe("Fira Code");
  });

  it("normalizes window state with valid numbers", () => {
    const result = normalizePreferences({ window: { width: 1200, height: 800, x: 100, y: 50 } });
    expect(result.window?.width).toBe(1200);
    expect(result.window?.height).toBe(800);
    expect(result.window?.x).toBe(100);
    expect(result.window?.y).toBe(50);
  });

  it("ignores non-finite window numbers", () => {
    const result = normalizePreferences({ window: { width: Infinity, height: NaN } });
    expect(result.window?.width).toBeUndefined();
    expect(result.window?.height).toBeUndefined();
  });

  it("preserves unknown top-level keys", () => {
    const result = normalizePreferences({ unknownKey: "val" }) as Record<string, unknown>;
    expect(result.unknownKey).toBe("val");
  });

  it("preserves unknown appearance keys", () => {
    const result = normalizePreferences({
      appearance: { themeMode: "light", customField: "yes" },
    }) as Record<string, unknown>;
    const ap = result.appearance as Record<string, unknown>;
    expect(ap.customField).toBe("yes");
    expect(ap.themeMode).toBe("light");
  });

  it("preserves unknown window keys alongside valid numeric fields", () => {
    const result = normalizePreferences({
      window: { width: 1200, height: 800, extra: "keep" },
    }) as Record<string, unknown>;
    const win = result.window as Record<string, unknown>;
    expect(win.width).toBe(1200);
    expect(win.extra).toBe("keep");
  });

  it("preserves valid collection active view ids", () => {
    const result = normalizePreferences({
      collections: { activeViewId: { "jira-issue": "jira-issue-mine" } },
    });
    expect(result.collections?.activeViewId?.["jira-issue"]).toBe("jira-issue-mine");
  });

  it("drops invalid active view ids but preserves unknown collection keys", () => {
    const result = normalizePreferences({
      collections: {
        activeViewId: { "jira-issue": "   ", "github-issue": 42 },
        customCollectionKey: { keep: true },
      },
    }) as Record<string, unknown>;
    const collections = result.collections as Record<string, unknown>;
    expect(collections.activeViewId).toEqual({});
    expect(collections.customCollectionKey).toEqual({ keep: true });
  });
});

describe("color scheme normalization", () => {
  it("defaults lightTheme to catppuccin-latte when missing", () => {
    const result = normalizePreferences({ appearance: {} });
    expect(result.appearance?.lightTheme).toBe("catppuccin-latte");
  });

  it("defaults darkTheme to catppuccin-macchiato when missing", () => {
    const result = normalizePreferences({ appearance: {} });
    expect(result.appearance?.darkTheme).toBe("catppuccin-macchiato");
  });

  it("accepts valid lightTheme id", () => {
    const result = normalizePreferences({ appearance: { lightTheme: "github-light" } });
    expect(result.appearance?.lightTheme).toBe("github-light");
  });

  it("rejects dark theme id in lightTheme slot — falls back to catppuccin-latte", () => {
    const result = normalizePreferences({ appearance: { lightTheme: "catppuccin-mocha" } });
    expect(result.appearance?.lightTheme).toBe("catppuccin-latte");
  });

  it("accepts valid darkTheme id", () => {
    const result = normalizePreferences({ appearance: { darkTheme: "dracula" } });
    expect(result.appearance?.darkTheme).toBe("dracula");
  });

  it("rejects light theme id in darkTheme slot — falls back to catppuccin-macchiato", () => {
    const result = normalizePreferences({ appearance: { darkTheme: "catppuccin-latte" } });
    expect(result.appearance?.darkTheme).toBe("catppuccin-macchiato");
  });

  it("rejects unknown theme id in lightTheme slot", () => {
    const result = normalizePreferences({ appearance: { lightTheme: "nonexistent" } });
    expect(result.appearance?.lightTheme).toBe("catppuccin-latte");
  });

  it("defaults catppuccin accent to sapphire when missing", () => {
    const result = normalizePreferences({ appearance: { themeFeatures: {} } });
    expect(result.appearance?.themeFeatures?.catppuccin?.accent).toBe("sapphire");
  });

  it("accepts valid catppuccin accent", () => {
    const result = normalizePreferences({ appearance: { themeFeatures: { catppuccin: { accent: "green" } } } });
    expect(result.appearance?.themeFeatures?.catppuccin?.accent).toBe("green");
  });

  it("rejects invalid catppuccin accent — falls back to sapphire", () => {
    const result = normalizePreferences({ appearance: { themeFeatures: { catppuccin: { accent: "rainbow" } } } });
    expect(result.appearance?.themeFeatures?.catppuccin?.accent).toBe("sapphire");
  });

  it("handles deprecated flavor: latte — maps to catppuccin-latte lightTheme", () => {
    const result = normalizePreferences({ appearance: { flavor: "latte" } });
    expect(result.appearance?.lightTheme).toBe("catppuccin-latte");
  });

  it("handles deprecated flavor: mocha — maps darkTheme to catppuccin-mocha", () => {
    const result = normalizePreferences({ appearance: { flavor: "mocha" } });
    expect(result.appearance?.darkTheme).toBe("catppuccin-mocha");
  });

  it("explicit lightTheme takes precedence over deprecated flavor", () => {
    const result = normalizePreferences({ appearance: { lightTheme: "github-light", flavor: "latte" } });
    expect(result.appearance?.lightTheme).toBe("github-light");
  });

  it("preserves unknown themeFeatures keys", () => {
    const result = normalizePreferences({
      appearance: { themeFeatures: { customTheme: { option: "yes" } } }
    }) as Record<string, unknown>;
    const ap = result.appearance as Record<string, unknown>;
    const features = ap.themeFeatures as Record<string, unknown>;
    expect(features.customTheme).toEqual({ option: "yes" });
  });

  it("defaults canonical primary and secondary accents", () => {
    const result = normalizePreferences({ appearance: {} });
    expect(result.appearance?.accents?.primary).toBe("sapphire");
    expect(result.appearance?.accents?.secondary).toBe("teal");
  });

  it("preserves valid canonical primary and secondary accents", () => {
    const result = normalizePreferences({
      appearance: { accents: { primary: "lavender", secondary: "blue" } },
    });
    expect(result.appearance?.accents?.primary).toBe("lavender");
    expect(result.appearance?.accents?.secondary).toBe("blue");
  });

  it("maps legacy Catppuccin accent to primary when canonical primary is missing", () => {
    const result = normalizePreferences({
      appearance: { themeFeatures: { catppuccin: { accent: "green" } } },
    });
    expect(result.appearance?.accents?.primary).toBe("green");
    expect(result.appearance?.themeFeatures?.catppuccin?.accent).toBe("green");
  });

  it("canonical primary wins over legacy Catppuccin accent", () => {
    const result = normalizePreferences({
      appearance: {
        accents: { primary: "lavender" },
        themeFeatures: { catppuccin: { accent: "green" } },
      },
    });
    expect(result.appearance?.accents?.primary).toBe("lavender");
    expect(result.appearance?.themeFeatures?.catppuccin?.accent).toBe("lavender");
  });

  it("rejects invalid canonical accents and falls back to documented defaults", () => {
    const result = normalizePreferences({
      appearance: { accents: { primary: "rainbow", secondary: "infrared" } },
    });
    expect(result.appearance?.accents?.primary).toBe("sapphire");
    expect(result.appearance?.accents?.secondary).toBe("teal");
  });
});

describe("mergePreferences", () => {
  it("merges appearance patch without erasing unrelated fields", () => {
    const current = { appearance: { themeMode: "dark" as const, uiFont: "Roboto", monoFont: "Fira Code" } };
    const result = mergePreferences(current, { appearance: { themeMode: "light" } });
    expect(result.appearance?.themeMode).toBe("light");
    expect(result.appearance?.uiFont).toBe("Roboto");
    expect(result.appearance?.monoFont).toBe("Fira Code");
  });

  it("merges window patch without erasing appearance", () => {
    const current = { appearance: { themeMode: "dark" as const }, window: { width: 800, height: 600 } };
    const result = mergePreferences(current, { window: { width: 1200 } });
    expect(result.appearance?.themeMode).toBe("dark");
    expect(result.window?.width).toBe(1200);
    expect(result.window?.height).toBe(600);
  });

  it("merges collection active view ids without erasing existing entities", () => {
    const current = { collections: { activeViewId: { "jira-issue": "all", "github-issue": "mine" } } };
    const result = mergePreferences(current, {
      collections: { activeViewId: { "jira-issue": "recent" } },
    });
    expect(result.collections?.activeViewId).toEqual({
      "jira-issue": "recent",
      "github-issue": "mine",
    });
  });

  it("merges primary accent without erasing secondary accent", () => {
    const current = { appearance: { accents: { primary: "sapphire" as const, secondary: "teal" as const } } };
    const result = mergePreferences(current, { appearance: { accents: { primary: "lavender" } } });
    expect(result.appearance?.accents).toEqual({ primary: "lavender", secondary: "teal" });
  });

  it("merges secondary accent without erasing primary accent", () => {
    const current = { appearance: { accents: { primary: "sapphire" as const, secondary: "teal" as const } } };
    const result = mergePreferences(current, { appearance: { accents: { secondary: "blue" } } });
    expect(result.appearance?.accents).toEqual({ primary: "sapphire", secondary: "blue" });
  });
});

describe("resolvedPreferences", () => {
  it("fills missing fields from defaults", () => {
    const result = resolvedPreferences({});
    expect(result.appearance?.themeMode).toBe(DEFAULT_PREFERENCES.appearance?.themeMode);
    expect(result.appearance?.uiFont).toBe(DEFAULT_PREFERENCES.appearance?.uiFont);
  });

  it("preserves saved values over defaults", () => {
    const result = resolvedPreferences({ appearance: { themeMode: "dark" } });
    expect(result.appearance?.themeMode).toBe("dark");
  });
});

describe("resolveThemeSlots", () => {
  it("returns defaults when no appearance prefs", () => {
    const result = resolveThemeSlots({});
    expect(result.lightTheme).toBe("catppuccin-latte");
    expect(result.darkTheme).toBe("catppuccin-macchiato");
  });

  it("returns saved valid light theme", () => {
    const result = resolveThemeSlots({ appearance: { lightTheme: "github-light" } });
    expect(result.lightTheme).toBe("github-light");
  });

  it("falls back lightTheme if invalid", () => {
    const result = resolveThemeSlots({ appearance: { lightTheme: "catppuccin-mocha" } });
    expect(result.lightTheme).toBe("catppuccin-latte");
  });
});

describe("resolveTheme", () => {
  it("light mode resolves to lightTheme with brightness light", () => {
    const result = resolveTheme({ appearance: { themeMode: "light", lightTheme: "github-light" } }, false);
    expect(result.themeId).toBe("github-light");
    expect(result.brightness).toBe("light");
  });

  it("light mode resolves to lightTheme with brightness light and accent ids", () => {
    const result = resolveTheme(
      { appearance: { themeMode: "light", lightTheme: "github-light", accents: { primary: "lavender", secondary: "blue" } } },
      false,
    );
    expect(result.themeId).toBe("github-light");
    expect(result.brightness).toBe("light");
    expect(result.primaryAccent).toBe("lavender");
    expect(result.secondaryAccent).toBe("blue");
  });

  it("dark mode resolves to darkTheme with brightness dark", () => {
    const result = resolveTheme({ appearance: { themeMode: "dark", darkTheme: "dracula" } }, false);
    expect(result.themeId).toBe("dracula");
    expect(result.brightness).toBe("dark");
  });

  it("system mode with prefersDark=true resolves to darkTheme", () => {
    const result = resolveTheme({ appearance: { themeMode: "system", darkTheme: "catppuccin-mocha" } }, true);
    expect(result.themeId).toBe("catppuccin-mocha");
    expect(result.brightness).toBe("dark");
  });

  it("system mode with prefersDark=false resolves to lightTheme", () => {
    const result = resolveTheme({ appearance: { themeMode: "system" } }, false);
    expect(result.themeId).toBe("catppuccin-latte");
    expect(result.brightness).toBe("light");
  });

  it("defaults themeMode to system when missing", () => {
    const result = resolveTheme({}, false);
    expect(result.themeId).toBe("catppuccin-latte");
    expect(result.brightness).toBe("light");
  });
});

describe("resolveCatppuccinAccent", () => {
  it("returns saved valid accent", () => {
    expect(resolveCatppuccinAccent({ appearance: { themeFeatures: { catppuccin: { accent: "green" } } } })).toBe("green");
  });

  it("returns sapphire as default when missing", () => {
    expect(resolveCatppuccinAccent({})).toBe("sapphire");
  });

  it("returns sapphire for invalid accent", () => {
    expect(resolveCatppuccinAccent({ appearance: { themeFeatures: { catppuccin: { accent: "rainbow" as never } } } })).toBe("sapphire");
  });
});

describe("resolveAppearanceAccents", () => {
  it("returns canonical accent ids", () => {
    expect(
      resolveAppearanceAccents({ appearance: { accents: { primary: "mauve", secondary: "sky" } } }),
    ).toEqual({ primaryAccent: "mauve", secondaryAccent: "sky" });
  });

  it("falls back through legacy Catppuccin accent for primary", () => {
    expect(
      resolveAppearanceAccents({ appearance: { themeFeatures: { catppuccin: { accent: "green" } } } }),
    ).toEqual({ primaryAccent: "green", secondaryAccent: "teal" });
  });
});
