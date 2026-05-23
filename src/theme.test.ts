import { describe, it, expect, afterEach } from "vitest";
import {
  THEME_CATALOG,
  CATPPUCCIN_ACCENTS,
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
    root.style.removeProperty("--hm-accent");
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

  it("writes data-accent and --hm-accent CSS var when accent is provided", () => {
    applyColorScheme({ themeId: "catppuccin-mocha", brightness: "dark", accent: "green" });
    expect(root.dataset.accent).toBe("green");
    expect(root.style.getPropertyValue("--hm-accent")).toBe("var(--ctp-green)");
  });

  it("clears data-accent and --hm-accent when no accent is provided", () => {
    root.dataset.accent = "green";
    root.style.setProperty("--hm-accent", "var(--ctp-green)");
    applyColorScheme({ themeId: "github-dark", brightness: "dark" });
    expect(root.dataset.accent).toBeUndefined();
    expect(root.style.getPropertyValue("--hm-accent")).toBe("");
  });

  it("applies each Catppuccin accent correctly", () => {
    for (const accent of CATPPUCCIN_ACCENTS) {
      applyColorScheme({ themeId: "catppuccin-mocha", brightness: "dark", accent });
      expect(root.dataset.accent).toBe(accent);
      expect(root.style.getPropertyValue("--hm-accent")).toBe(`var(--ctp-${accent})`);
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
