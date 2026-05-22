import type { AppPreferences } from "./preferences";

const MIN_WIDTH = 400;
const MIN_HEIGHT = 300;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function isUsablePosition(x: number, y: number): boolean {
  return x > -2000 && x < 10000 && y > -2000 && y < 10000;
}

export async function restoreWindowState(prefs: AppPreferences): Promise<void> {
  if (!isTauri()) return;
  const win = prefs.window;
  if (!win) return;

  try {
    const { getCurrentWindow, LogicalSize, LogicalPosition } = await import("@tauri-apps/api/window");
    const appWindow = getCurrentWindow();

    if (
      typeof win.width === "number" &&
      typeof win.height === "number" &&
      win.width >= MIN_WIDTH &&
      win.height >= MIN_HEIGHT
    ) {
      await appWindow.setSize(new LogicalSize(win.width, win.height));
    }

    if (
      typeof win.x === "number" &&
      typeof win.y === "number" &&
      isUsablePosition(win.x, win.y)
    ) {
      await appWindow.setPosition(new LogicalPosition(win.x, win.y));
    }
  } catch (err) {
    console.warn("[windowState] restore failed:", err);
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export async function persistWindowState(
  updatePrefs: (patch: Partial<AppPreferences>) => Promise<void>
): Promise<void> {
  if (!isTauri()) return;

  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const appWindow = getCurrentWindow();
      const size = await appWindow.innerSize();
      const pos = await appWindow.outerPosition();
      await updatePrefs({
        window: {
          width: size.width,
          height: size.height,
          x: pos.x,
          y: pos.y,
        },
      });
    } catch (err) {
      console.warn("[windowState] persist failed:", err);
    }
  }, 500);
}

export function cleanupWindowStateDebounce(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}
