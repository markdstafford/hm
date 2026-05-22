import { describe, it, expect } from "vitest";
import {
  normalizePreferences,
  mergePreferences,
  resolvedPreferences,
  DEFAULT_PREFERENCES,
} from "./preferences";

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

  it("ignores unknown top-level keys — does not crash", () => {
    expect(() => normalizePreferences({ unknownKey: "val" })).not.toThrow();
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
