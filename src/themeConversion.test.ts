import { describe, it, expect } from "vitest";
import { convertVscodeTheme, VSCODE_TOKEN_MAP } from "./themeConversion";

describe("VSCODE_TOKEN_MAP", () => {
  it("maps every hm semantic token at least once", () => {
    const hmTokens = VSCODE_TOKEN_MAP.map((e) => e.hmToken);
    expect(hmTokens).toContain("--color-background");
    expect(hmTokens).toContain("--color-text");
    expect(hmTokens).toContain("--color-primary");
    expect(hmTokens).toContain("--color-on-primary");
    expect(hmTokens).toContain("--color-border");
    expect(hmTokens).toContain("--color-focus");
  });

  it("has no empty vscodeKeys arrays", () => {
    for (const entry of VSCODE_TOKEN_MAP) {
      expect(entry.vscodeKeys.length).toBeGreaterThan(0);
    }
  });
});

describe("convertVscodeTheme", () => {
  it("returns empty object for empty input", () => {
    expect(convertVscodeTheme({})).toEqual({});
  });

  it("maps a single VS Code key to the corresponding hm token", () => {
    const result = convertVscodeTheme({ "editor.background": "#1e1e1e" });
    expect(result["--color-background"]).toBe("#1e1e1e");
  });

  it("uses the first matching key when multiple candidates are present", () => {
    // sideBar.background takes priority over activityBar.background for --color-mantle
    const result = convertVscodeTheme({
      "sideBar.background": "#aabbcc",
      "activityBar.background": "#ddeeff",
    });
    expect(result["--color-mantle"]).toBe("#aabbcc");
  });

  it("falls back to second key when first is absent", () => {
    const result = convertVscodeTheme({ "activityBar.background": "#ddeeff" });
    expect(result["--color-mantle"]).toBe("#ddeeff");
  });

  it("ignores unknown VS Code keys", () => {
    const result = convertVscodeTheme({ "totally.unknown.key": "#ff0000" });
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("handles a Catppuccin-like theme subset", () => {
    // Minimal keys matching catppuccin-latte-style values
    const catppuccinLikeColors = {
      "editor.background": "#eff1f5",
      "editor.foreground": "#4c4f69",
      "focusBorder": "#209fb5",
      "button.background": "#209fb5",
      "button.foreground": "#1e2030",
    };
    const result = convertVscodeTheme(catppuccinLikeColors);
    expect(result["--color-background"]).toBe("#eff1f5");
    expect(result["--color-text"]).toBe("#4c4f69");
    expect(result["--color-focus"]).toBe("#209fb5");
    expect(result["--color-primary"]).toBe("#209fb5");
    expect(result["--color-on-primary"]).toBe("#1e2030");
  });

  it("handles a GitHub Dark-like theme subset", () => {
    const githubDarkColors = {
      "editor.background": "#0d1117",
      "editor.foreground": "#e6edf3",
      "sideBar.background": "#161b22",
      "button.background": "#2f81f7",
      "button.foreground": "#ffffff",
      "focusBorder": "#2f81f7",
      "panel.border": "#30363d",
    };
    const result = convertVscodeTheme(githubDarkColors);
    expect(result["--color-background"]).toBe("#0d1117");
    expect(result["--color-text"]).toBe("#e6edf3");
    expect(result["--color-mantle"]).toBe("#161b22");
    expect(result["--color-primary"]).toBe("#2f81f7");
    expect(result["--color-on-primary"]).toBe("#ffffff");
    expect(result["--color-border"]).toBe("#30363d");
  });

  it("does not include hm tokens with no matching VS Code keys", () => {
    // Only background is provided; other tokens should not appear
    const result = convertVscodeTheme({ "editor.background": "#ffffff" });
    expect(result).not.toHaveProperty("--color-text");
    expect(result).not.toHaveProperty("--color-primary");
  });
});
