import { describe, it, expect } from "vitest";
import { normalizeBinding, eventMatchesBinding, isFormFieldTarget, formatBinding } from "./keys";

describe("normalizeBinding", () => {
  it("lowercases and sorts modifiers", () => {
    expect(normalizeBinding("⌘+Shift+D")).toEqual({ key: "d", mods: ["meta", "shift"] });
    expect(normalizeBinding("Ctrl+K")).toEqual({ key: "k", mods: ["ctrl"] });
  });
  it("handles single keys", () => {
    expect(normalizeBinding("[")).toEqual({ key: "[", mods: [] });
    expect(normalizeBinding("?")).toEqual({ key: "?", mods: [] });
  });
});

describe("eventMatchesBinding", () => {
  const make = (init: Partial<KeyboardEvent>) =>
    new KeyboardEvent("keydown", { key: init.key, metaKey: !!init.metaKey, ctrlKey: !!init.ctrlKey, shiftKey: !!init.shiftKey, altKey: !!init.altKey });

  it("matches single key without mods", () => {
    expect(eventMatchesBinding(make({ key: "[" }), normalizeBinding("["))).toBe(true);
  });
  it("matches combo", () => {
    expect(eventMatchesBinding(make({ key: "d", metaKey: true, shiftKey: true }), normalizeBinding("⌘+shift+d"))).toBe(true);
  });
  it("rejects when modifiers differ", () => {
    expect(eventMatchesBinding(make({ key: "d", metaKey: true }), normalizeBinding("⌘+shift+d"))).toBe(false);
  });
});

describe("isFormFieldTarget", () => {
  it("returns true for INPUT/TEXTAREA/contentEditable", () => {
    const input = document.createElement("input");
    const ta = document.createElement("textarea");
    const ce = document.createElement("div");
    ce.contentEditable = "true";
    expect(isFormFieldTarget(input)).toBe(true);
    expect(isFormFieldTarget(ta)).toBe(true);
    expect(isFormFieldTarget(ce)).toBe(true);
  });
  it("returns false for non-form elements", () => {
    expect(isFormFieldTarget(document.createElement("button"))).toBe(false);
    expect(isFormFieldTarget(null)).toBe(false);
  });
});

describe("formatBinding", () => {
  it("uses ⌘/⌥/⌃/⇧ glyphs on macOS", () => {
    expect(formatBinding("⌘+shift+d", "mac")).toBe("⌘⇧D");
    expect(formatBinding("[", "mac")).toBe("[");
  });
  it("uses Ctrl spelled on non-mac", () => {
    expect(formatBinding("⌘+shift+d", "other")).toBe("Ctrl+Shift+D");
  });
});
