import type { ThemeMode } from "./preferences";

export function applyTheme(mode: ThemeMode, _prefersDark: boolean): void {
  const root = document.documentElement;
  if (mode === "light") {
    root.setAttribute("data-theme", "latte");
  } else if (mode === "dark") {
    root.setAttribute("data-theme", "macchiato");
  } else {
    // system: remove forced data-theme so CSS media query rules take over
    root.removeAttribute("data-theme");
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
