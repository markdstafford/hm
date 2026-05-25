export type Mod = "meta" | "ctrl" | "alt" | "shift";

export type NormalizedBinding = {
  key: string;
  mods: Mod[];
};

const MOD_ALIASES: Record<string, Mod> = {
  "⌘": "meta",
  cmd: "meta",
  meta: "meta",
  "⌃": "ctrl",
  ctrl: "ctrl",
  control: "ctrl",
  "⌥": "alt",
  alt: "alt",
  option: "alt",
  "⇧": "shift",
  shift: "shift",
};

const MOD_ORDER: Mod[] = ["ctrl", "alt", "meta", "shift"];

export function normalizeBinding(input: string): NormalizedBinding {
  const tokens = input.split("+").map((t) => t.trim()).filter(Boolean);
  const mods: Mod[] = [];
  let key = "";
  for (const t of tokens) {
    const m = MOD_ALIASES[t.toLowerCase()];
    if (m) {
      if (!mods.includes(m)) mods.push(m);
    } else {
      key = t.toLowerCase();
    }
  }
  mods.sort((a, b) => MOD_ORDER.indexOf(a) - MOD_ORDER.indexOf(b));
  return { key, mods };
}

export function eventMatchesBinding(e: KeyboardEvent, b: NormalizedBinding): boolean {
  if (e.key.toLowerCase() !== b.key) return false;
  const have: Mod[] = [];
  if (e.metaKey) have.push("meta");
  if (e.ctrlKey) have.push("ctrl");
  if (e.altKey) have.push("alt");
  if (e.shiftKey) have.push("shift");
  if (have.length !== b.mods.length) return false;
  return b.mods.every((m) => have.includes(m));
}

export function isFormFieldTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return true;
  if (target.isContentEditable) return true;
  const ce = target.contentEditable;
  if (ce === "true" || ce === "plaintext-only") return true;
  return false;
}

const MAC_GLYPHS: Record<Mod, string> = {
  meta: "⌘",
  ctrl: "⌃",
  alt: "⌥",
  shift: "⇧",
};

const SPELLED: Record<Mod, string> = {
  meta: "Meta",
  ctrl: "Ctrl",
  alt: "Alt",
  shift: "Shift",
};

export type Platform = "mac" | "other";

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  return navigator.platform.toUpperCase().includes("MAC") ? "mac" : "other";
}

export function formatBinding(input: string, platform: Platform = detectPlatform()): string {
  const norm = normalizeBinding(input);
  // On non-mac, swap meta → ctrl for display
  const mods = platform === "mac"
    ? norm.mods
    : norm.mods.map((m) => (m === "meta" ? "ctrl" : m));
  const keyDisplay = norm.key.length === 1 ? norm.key.toUpperCase() : norm.key;
  if (platform === "mac") {
    return mods.map((m) => MAC_GLYPHS[m]).join("") + keyDisplay;
  }
  return [...mods.map((m) => SPELLED[m]), keyDisplay].join("+");
}
