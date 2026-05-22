import { Settings } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { commands, type AppStatus } from "./bindings";
import { type AppPreferences, DEFAULT_PREFERENCES } from "./preferences";
import { applyTheme, applyFonts, getSystemPrefersDark } from "./theme";
import { loadPreferences, savePreferences } from "./settings/settingsStorage";
import { restoreWindowState, persistWindowState } from "./windowState";
import { SettingsPanel } from "./settings/SettingsPanel";

function App() {
  const [prefs, setPrefs] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsOpenerRef = useRef<HTMLButtonElement>(null);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences().then((loaded) => {
      setPrefs(loaded);
      restoreWindowState(loaded);
    });
  }, []);

  // Apply theme whenever themeMode changes
  useEffect(() => {
    const mode = prefs.appearance?.themeMode ?? "system";
    applyTheme(mode, getSystemPrefersDark());

    if (mode !== "system") return;
    // Listen for system theme changes while in system mode
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system", mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [prefs.appearance?.themeMode]);

  // Apply fonts whenever font prefs change
  useEffect(() => {
    applyFonts(
      prefs.appearance?.uiFont ?? DEFAULT_PREFERENCES.appearance!.uiFont!,
      prefs.appearance?.monoFont ?? DEFAULT_PREFERENCES.appearance!.monoFont!
    );
  }, [prefs.appearance?.uiFont, prefs.appearance?.monoFont]);

  // Load app status
  useEffect(() => {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      commands.appStatus().then(setStatus).catch(console.error);
    }
  }, []);

  const updatePreferences = useCallback(async (patch: Partial<AppPreferences>) => {
    const result = await savePreferences(prefs, patch);
    setPrefs(result.next);
    if (!result.ok) {
      setSaveError("Could not save preferences");
      setTimeout(() => setSaveError(null), 4000);
    }
    persistWindowState(async (winPatch) => {
      await savePreferences(result.next, winPatch);
    });
  }, [prefs]);

  const handleSettingsOpen = () => setSettingsOpen(true);
  const handleSettingsClose = () => {
    setSettingsOpen(false);
    setTimeout(() => settingsOpenerRef.current?.focus(), 0);
  };

  return (
    <main className="min-h-screen bg-background text-text flex flex-col items-center justify-center gap-6 font-sans">
      <h1 className="text-lg font-semibold tracking-tight">hello hm</h1>

      <p className="text-sm text-subtext">
        Catppuccin &middot; sapphire accent
      </p>

      <div className="flex items-center gap-3">
        <div className="h-control-base px-4 rounded bg-primary text-background text-sm flex items-center">
          Primary button
        </div>
        <div className="h-control-base px-4 rounded border border-border text-sm flex items-center">
          Secondary button
        </div>
      </div>

      <button
        ref={settingsOpenerRef}
        onClick={handleSettingsOpen}
        aria-label="Open settings"
        className="flex items-center gap-2 text-sm text-subtext hover:text-text transition-colors"
      >
        <Settings size={14} aria-hidden={true} />
        Settings
      </button>

      {saveError && (
        <p role="alert" className="text-xs text-red">
          {saveError}
        </p>
      )}

      {status && (
        <p className="text-xs text-subtext font-mono">
          v{status.version} · ready: {String(status.ready)}
        </p>
      )}

      <SettingsPanel
        open={settingsOpen}
        onClose={handleSettingsClose}
        prefs={prefs}
        onUpdatePreferences={updatePreferences}
      />
    </main>
  );
}

export default App;
