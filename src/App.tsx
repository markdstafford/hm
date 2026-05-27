import { useState, useEffect, useCallback, useRef } from "react";
import { Inbox, ListTodo, Settings as SettingsIcon, PanelLeft, Sparkles, MessageSquare, X } from "lucide-react";
import { commands, type AppStatus } from "./bindings";
import {
  type AppPreferences,
  DEFAULT_PREFERENCES,
  resolveTheme,
  resolveCatppuccinAccent,
} from "./preferences";
import { applyColorScheme, applyFonts, getSystemPrefersDark } from "./theme";
import { loadPreferences, savePreferences } from "./preferences/storage";
import { restoreWindowState, registerWindowListeners } from "./windowState";
import { AppShell } from "./shell/AppShell";
import { useShortcut } from "./shell/useShortcut";
import { IconButton } from "./ui/buttons/IconButton";
import { NavSection } from "./ui/sidebar/NavSection";
import { NavItem } from "./ui/sidebar/NavItem";
import { ScopeHeader } from "./ui/sidebar/ScopeHeader";
import { Showcase } from "./_dev/Showcase";
import { InboxPage } from "./features/inbox/InboxPage";
import { useCollectionViewer } from "./features/collection-viewer/useCollectionViewer";
import { Breadcrumb } from "./ui/navigation/Breadcrumb";
import {
  SettingsPage,
  SettingsBreadcrumb,
} from "./features/settings/SettingsPage";
import { SettingsSidebar } from "./features/settings/SettingsSidebar";
import type { SettingsCategory } from "./features/settings/categories";

function App() {
  const [prefs, setPrefs] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [settingsPage, setSettingsPage] = useState<SettingsCategory | null>(null);
  const [showShowcase, setShowShowcase] = useState(false);
  type MainPage = "inbox" | "jira-issues";
  const [mainPage, setMainPage] = useState<MainPage>("inbox");
  const [prefersDark, setPrefersDark] = useState(getSystemPrefersDark);
  const settingsOpenerRef = useRef<HTMLButtonElement>(null);

  const prefsRef = useRef<AppPreferences>(DEFAULT_PREFERENCES);
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);

  useEffect(() => {
    loadPreferences().then((loaded) => {
      setPrefs(loaded);
      restoreWindowState(loaded);
    });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setPrefersDark(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const prefersDarkNow = getSystemPrefersDark();
    const resolved = resolveTheme(prefs, prefersDarkNow);
    const accent = resolveCatppuccinAccent(prefs);
    applyColorScheme({ ...resolved, accent });

    const mode = prefs.appearance?.themeMode ?? "system";
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const r = resolveTheme(prefs, mq.matches);
      const a = resolveCatppuccinAccent(prefs);
      applyColorScheme({ ...r, accent: a });
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [
    prefs.appearance?.themeMode,
    prefs.appearance?.lightTheme,
    prefs.appearance?.darkTheme,
    prefs.appearance?.themeFeatures,
  ]);

  useEffect(() => {
    applyFonts(
      prefs.appearance?.uiFont ?? DEFAULT_PREFERENCES.appearance!.uiFont!,
      prefs.appearance?.monoFont ?? DEFAULT_PREFERENCES.appearance!.monoFont!,
    );
  }, [prefs.appearance?.uiFont, prefs.appearance?.monoFont]);

  useEffect(() => {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      commands.appStatus().then(setStatus).catch(console.error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    let cleanup: (() => void) | null = null;
    registerWindowListeners(async (winPatch) => {
      const result = await savePreferences(prefsRef.current, winPatch);
      if (result.ok) setPrefs(result.next);
    }).then((fn) => { cleanup = fn; });
    return () => { cleanup?.(); };
  }, []);

  const updatePreferences = useCallback(async (patch: Partial<AppPreferences>) => {
    const result = await savePreferences(prefs, patch);
    setPrefs(result.next);
    if (!result.ok) {
      setSaveError("Could not save preferences");
      setTimeout(() => setSaveError(null), 4000);
    }
  }, [prefs]);

  useShortcut("⌘+shift+d", () => setShowShowcase((v) => !v), { allowInForm: true });

  const inSettings = settingsPage !== null;
  const handleCloseSettings = () => {
    setSettingsPage(null);
    setTimeout(() => settingsOpenerRef.current?.focus(), 0);
  };

  // Always mount the collection-viewer hook so its view state survives page
  // switches. The `active` flag gates keyboard navigation so arrow keys do not
  // move selection when the user is on Inbox / Settings / Showcase.
  const collectionViewer = useCollectionViewer({
    active: !inSettings && !showShowcase && mainPage === "jira-issues",
  });

  const page = inSettings
    ? {
        titleBar: <SettingsBreadcrumb category={settingsPage!} />,
        header: null as React.ReactNode,
        content: (
          <SettingsPage
            category={settingsPage!}
            onPickCategory={setSettingsPage}
            prefs={prefs}
            onUpdatePreferences={updatePreferences}
            prefersDark={prefersDark}
          />
        ),
      }
    : showShowcase
    ? { titleBar: <span className="text-sm text-text">Showcase</span>, header: null as React.ReactNode, content: <Showcase /> }
    : mainPage === "jira-issues"
    ? {
        titleBar: <Breadcrumb items={[{ label: "Jira issues", isCurrent: true }]} />,
        header: collectionViewer.header,
        content: collectionViewer.body,
      }
    : InboxPage;

  return (
    <>
      <AppShell
        sidebarHeader={inSettings ? null : <ScopeHeader name="Personal" />}
        sidebarContent={
          inSettings ? (
            <SettingsSidebar current={settingsPage!} onPick={setSettingsPage} />
          ) : (
            <NavSection label="Personal">
              <NavItem
                label="Inbox"
                count={0}
                icon={<Inbox size={12} />}
                active={mainPage === "inbox"}
                onClick={() => setMainPage("inbox")}
              />
              <NavItem
                label="Jira issues"
                icon={<ListTodo size={12} />}
                active={mainPage === "jira-issues"}
                onClick={() => setMainPage("jira-issues")}
              />
            </NavSection>
          )
        }
        mainTitleBarStart={page.titleBar}
        mainTitleBarEnd={
          inSettings ? (
            <IconButton label="Close settings" onClick={handleCloseSettings}>
              <X size={12} aria-hidden={true} />
            </IconButton>
          ) : (
            <IconButton
              ref={settingsOpenerRef}
              label="Open settings"
              onClick={() => setSettingsPage("general")}
            >
              <SettingsIcon size={12} aria-hidden={true} />
            </IconButton>
          )
        }
        mainHeader={page.header ?? undefined}
        mainContent={page.content}
        footerLeft={({ sidebarVisible, toggleSidebar }) => (
          <IconButton label="Toggle sidebar" active={sidebarVisible} onClick={toggleSidebar}>
            <PanelLeft size={12} />
          </IconButton>
        )}
        footerCenter={status ? <span className="font-mono">v{status.version} · ready: {String(status.ready)}</span> : null}
        footerRight={
          <>
            <IconButton label="AI assistant (coming soon)" disabled><Sparkles size={12} /></IconButton>
            <IconButton label="Chat (coming soon)" disabled><MessageSquare size={12} /></IconButton>
          </>
        }
      />

      {saveError && (
        <p role="alert" className="fixed bottom-12 left-4 text-xs text-red bg-mantle px-2 py-1 rounded border border-red">
          {saveError}
        </p>
      )}
    </>
  );
}

export default App;
