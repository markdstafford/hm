import { describe, it, expect, afterEach } from "vitest";
import {
  THEME_CATALOG,
  CATPPUCCIN_ACCENTS,
  ACCENT_OPTIONS,
  DEFAULT_PRIMARY_ACCENT,
  DEFAULT_SECONDARY_ACCENT,
  isAccentId,
  resolveThemeAccent,
  themeSupportsAccent,
  applyColorScheme,
  isLightTheme,
  isDarkTheme,
  themeSupportsFeature,
  LIGHT_THEMES,
  DARK_THEMES,
} from "./theme";

describe("THEME_CATALOG", () => {
  it("includes catppuccin-latte as light with catppuccinAccent", () => {
    const entry = THEME_CATALOG.find((t) => t.id === "catppuccin-latte");
    expect(entry?.brightness).toBe("light");
    expect(entry?.family).toBe("catppuccin");
    expect(entry?.features).toContain("catppuccinAccent");
  });

  it("includes catppuccin-frappe as dark with catppuccinAccent", () => {
    const entry = THEME_CATALOG.find((t) => t.id === "catppuccin-frappe");
    expect(entry?.brightness).toBe("dark");
    expect(entry?.features).toContain("catppuccinAccent");
  });

  it("includes catppuccin-macchiato as dark", () => {
    expect(THEME_CATALOG.find((t) => t.id === "catppuccin-macchiato")?.brightness).toBe("dark");
  });

  it("includes catppuccin-mocha as dark", () => {
    expect(THEME_CATALOG.find((t) => t.id === "catppuccin-mocha")?.brightness).toBe("dark");
  });

  it("includes github-light as light with no catppuccinAccent", () => {
    const entry = THEME_CATALOG.find((t) => t.id === "github-light");
    expect(entry?.brightness).toBe("light");
    expect(entry?.features).not.toContain("catppuccinAccent");
  });

  it("includes github-dark as dark", () => {
    expect(THEME_CATALOG.find((t) => t.id === "github-dark")?.brightness).toBe("dark");
  });

  it("includes solarized-light as light", () => {
    expect(THEME_CATALOG.find((t) => t.id === "solarized-light")?.brightness).toBe("light");
  });

  it("includes dracula as dark", () => {
    expect(THEME_CATALOG.find((t) => t.id === "dracula")?.brightness).toBe("dark");
  });

  it("has exactly 8 entries", () => {
    expect(THEME_CATALOG).toHaveLength(8);
  });
});

describe("CATPPUCCIN_ACCENTS", () => {
  it("contains all 14 accents", () => {
    expect(CATPPUCCIN_ACCENTS).toHaveLength(14);
    expect(CATPPUCCIN_ACCENTS).toContain("sapphire");
    expect(CATPPUCCIN_ACCENTS).toContain("green");
    expect(CATPPUCCIN_ACCENTS).toContain("lavender");
  });
});

describe("ACCENT_OPTIONS", () => {
  it("contains the fourteen stable Catppuccin-compatible accent ids", () => {
    expect(ACCENT_OPTIONS).toHaveLength(14);
    expect(ACCENT_OPTIONS.map((option) => option.value)).toEqual(CATPPUCCIN_ACCENTS);
    expect(ACCENT_OPTIONS.find((option) => option.value === "sapphire")?.label).toBe("Sapphire");
    expect(ACCENT_OPTIONS.find((option) => option.value === "teal")?.label).toBe("Teal");
  });

  it("documents sapphire primary and teal secondary defaults", () => {
    expect(DEFAULT_PRIMARY_ACCENT).toBe("sapphire");
    expect(DEFAULT_SECONDARY_ACCENT).toBe("teal");
  });
});

describe("accent helpers", () => {
  it("validates accent ids", () => {
    expect(isAccentId("lavender")).toBe(true);
    expect(isAccentId("rainbow")).toBe(false);
    expect(isAccentId(null)).toBe(false);
  });

  it("resolves primary and secondary accent variables for every shipped theme", () => {
    for (const entry of THEME_CATALOG) {
      expect(themeSupportsAccent(entry.id, "sapphire")).toBe(true);
      expect(resolveThemeAccent(entry.id, "sapphire", "primary")).toBe("var(--hm-accent-sapphire)");
      expect(resolveThemeAccent(entry.id, "teal", "secondary")).toBe("var(--hm-accent-teal)");
    }
  });

  it("falls back invalid accent ids by role", () => {
    expect(resolveThemeAccent("github-light", "rainbow", "primary")).toBe("var(--hm-accent-sapphire)");
    expect(resolveThemeAccent("github-light", "rainbow", "secondary")).toBe("var(--hm-accent-teal)");
  });
});

describe("isLightTheme / isDarkTheme", () => {
  it("isLightTheme returns true for catppuccin-latte", () => {
    expect(isLightTheme("catppuccin-latte")).toBe(true);
  });

  it("isLightTheme returns true for github-light", () => {
    expect(isLightTheme("github-light")).toBe(true);
  });

  it("isLightTheme returns true for solarized-light", () => {
    expect(isLightTheme("solarized-light")).toBe(true);
  });

  it("isLightTheme returns false for catppuccin-mocha", () => {
    expect(isLightTheme("catppuccin-mocha")).toBe(false);
  });

  it("isDarkTheme returns true for dracula", () => {
    expect(isDarkTheme("dracula")).toBe(true);
  });

  it("isDarkTheme returns true for catppuccin-frappe", () => {
    expect(isDarkTheme("catppuccin-frappe")).toBe(true);
  });

  it("isDarkTheme returns false for github-light", () => {
    expect(isDarkTheme("github-light")).toBe(false);
  });

  it("isLightTheme returns false for unknown id", () => {
    expect(isLightTheme("nonexistent")).toBe(false);
  });

  it("isDarkTheme returns false for unknown id", () => {
    expect(isDarkTheme("nonexistent")).toBe(false);
  });
});

describe("themeSupportsFeature", () => {
  it("catppuccin-latte supports catppuccinAccent", () => {
    expect(themeSupportsFeature("catppuccin-latte", "catppuccinAccent")).toBe(true);
  });

  it("catppuccin-mocha supports catppuccinAccent", () => {
    expect(themeSupportsFeature("catppuccin-mocha", "catppuccinAccent")).toBe(true);
  });

  it("github-light does not support catppuccinAccent", () => {
    expect(themeSupportsFeature("github-light", "catppuccinAccent")).toBe(false);
  });

  it("dracula does not support catppuccinAccent", () => {
    expect(themeSupportsFeature("dracula", "catppuccinAccent")).toBe(false);
  });
});

describe("applyColorScheme", () => {
  const root = document.documentElement;

  afterEach(() => {
    delete root.dataset.theme;
    delete root.dataset.themeMode;
    delete root.dataset.accent;
    delete root.dataset.primaryAccent;
    delete root.dataset.secondaryAccent;
    root.style.removeProperty("--hm-accent");
    root.style.removeProperty("--hm-primary-accent");
    root.style.removeProperty("--hm-secondary-accent");
  });

  it("writes data-theme and data-theme-mode for light theme", () => {
    applyColorScheme({ themeId: "catppuccin-latte", brightness: "light" });
    expect(root.dataset.theme).toBe("catppuccin-latte");
    expect(root.dataset.themeMode).toBe("light");
  });

  it("writes data-theme and data-theme-mode for dark theme", () => {
    applyColorScheme({ themeId: "catppuccin-mocha", brightness: "dark" });
    expect(root.dataset.theme).toBe("catppuccin-mocha");
    expect(root.dataset.themeMode).toBe("dark");
  });

  it("writes primary and secondary accent data attributes and variables", () => {
    applyColorScheme({
      themeId: "catppuccin-mocha",
      brightness: "dark",
      primaryAccent: "green",
      secondaryAccent: "lavender",
    });
    expect(root.dataset.primaryAccent).toBe("green");
    expect(root.dataset.secondaryAccent).toBe("lavender");
    expect(root.style.getPropertyValue("--hm-primary-accent")).toBe("var(--hm-accent-green)");
    expect(root.style.getPropertyValue("--hm-secondary-accent")).toBe("var(--hm-accent-lavender)");
  });

  it("keeps data-accent and --hm-accent as primary compatibility aliases", () => {
    applyColorScheme({
      themeId: "catppuccin-mocha",
      brightness: "dark",
      primaryAccent: "blue",
      secondaryAccent: "teal",
    });
    expect(root.dataset.accent).toBe("blue");
    expect(root.style.getPropertyValue("--hm-accent")).toBe("var(--hm-accent-blue)");
  });

  it("defaults missing primary and secondary accents before applying the DOM state", () => {
    applyColorScheme({ themeId: "github-dark", brightness: "dark" });
    expect(root.dataset.primaryAccent).toBe("sapphire");
    expect(root.dataset.secondaryAccent).toBe("teal");
    expect(root.style.getPropertyValue("--hm-primary-accent")).toBe("var(--hm-accent-sapphire)");
    expect(root.style.getPropertyValue("--hm-secondary-accent")).toBe("var(--hm-accent-teal)");
  });

  it("applies each accent as primary and secondary", () => {
    for (const accent of CATPPUCCIN_ACCENTS) {
      applyColorScheme({
        themeId: "catppuccin-mocha",
        brightness: "dark",
        primaryAccent: accent,
        secondaryAccent: accent,
      });
      expect(root.dataset.primaryAccent).toBe(accent);
      expect(root.dataset.secondaryAccent).toBe(accent);
      expect(root.style.getPropertyValue("--hm-primary-accent")).toBe(`var(--hm-accent-${accent})`);
      expect(root.style.getPropertyValue("--hm-secondary-accent")).toBe(`var(--hm-accent-${accent})`);
    }
  });

  it("works for all shipped theme ids", () => {
    for (const entry of THEME_CATALOG) {
      applyColorScheme({ themeId: entry.id, brightness: entry.brightness });
      expect(root.dataset.theme).toBe(entry.id);
      expect(root.dataset.themeMode).toBe(entry.brightness);
    }
  });
});

describe("LIGHT_THEMES / DARK_THEMES", () => {
  it("all LIGHT_THEMES have brightness light", () => {
    expect(LIGHT_THEMES.every((t) => t.brightness === "light")).toBe(true);
  });

  it("all DARK_THEMES have brightness dark", () => {
    expect(DARK_THEMES.every((t) => t.brightness === "dark")).toBe(true);
  });

  it("has 3 light themes", () => {
    expect(LIGHT_THEMES).toHaveLength(3);
  });

  it("has 5 dark themes", () => {
    expect(DARK_THEMES).toHaveLength(5);
  });
});
