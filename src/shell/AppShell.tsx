import { useCallback, type ReactNode } from "react";
import { useSidebarToggle } from "./useSidebarToggle";
import { useViewportBreakpoint } from "./useViewportBreakpoint";
import { useShortcut } from "./useShortcut";
import { Footer } from "./Footer";

export type AppShellProps = {
  sidebarTitleBar?: ReactNode;
  sidebarHeader?: ReactNode;
  sidebarContent: ReactNode;
  mainTitleBar: ReactNode;
  mainHeader?: ReactNode;
  mainContent: ReactNode;
  footerLeft?: ReactNode;
  footerCenter?: ReactNode;
  footerRight?: ReactNode;
  scrollCollapse?: "none" | "y2" | "y1-y2";
};

export function AppShell({
  sidebarTitleBar,
  sidebarHeader,
  sidebarContent,
  mainTitleBar,
  mainHeader,
  mainContent,
  footerLeft,
  footerCenter,
  footerRight,
}: AppShellProps) {
  const { visible, setVisible } = useSidebarToggle(true);
  const bp = useViewportBreakpoint();
  const overlay = bp === "narrow" && visible;
  const dismissOverlay = useCallback(() => {
    if (overlay) setVisible(false);
  }, [overlay, setVisible]);
  useShortcut("escape", dismissOverlay, { enabled: overlay });

  const showInColumn = visible && bp === "wide";

  return (
    <div
      data-sidebar-visible={visible || undefined}
      className="h-screen w-screen flex flex-col bg-background text-text font-sans overflow-hidden"
    >
      <div className="flex-1 flex min-h-0 relative">
        {/* Sidebar column (only in wide mode) */}
        {showInColumn && (
          <aside className="bg-mantle flex flex-col border-r border-border" style={{ width: "var(--width-sidebar)" }}>
            <div className="flex" style={{ height: "var(--height-title-bar)" }}>
              <div className="titlebar-no-drag" style={{ width: "var(--width-traffic-light)" }} />
              <div data-tauri-drag-region className="flex-1 bg-mantle">
                {sidebarTitleBar}
              </div>
            </div>
            {sidebarHeader && <div>{sidebarHeader}</div>}
            <div className="flex-1 overflow-y-auto py-1">{sidebarContent}</div>
          </aside>
        )}

        {/* Main pane */}
        <section className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center px-3 gap-2" style={{ height: "var(--height-title-bar)" }}>
            {!showInColumn && (
              <div className="titlebar-no-drag" style={{ width: "var(--width-traffic-light)" }} />
            )}
            <span className="titlebar-no-drag flex items-center gap-2 min-w-0">{mainTitleBar}</span>
            <div data-tauri-drag-region className="flex-1 min-w-0" />
          </div>
          {mainHeader && (
            <div className="flex items-center px-3" style={{ height: "var(--height-header-bar)" }}>
              <span className="titlebar-no-drag flex items-center gap-2 min-w-0 flex-1">{mainHeader}</span>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">{mainContent}</div>
        </section>

        {/* Overlay drawer (narrow + visible) */}
        {overlay && (
          <>
            <div
              role="presentation"
              onClick={dismissOverlay}
              className="absolute inset-0 bg-crust/50 z-30"
              style={{ bottom: "var(--height-footer)" }}
            />
            <aside
              className="absolute top-0 left-0 bg-mantle flex flex-col border-r border-border z-40"
              style={{ width: "var(--width-sidebar)", bottom: "var(--height-footer)" }}
            >
              <div className="flex" style={{ height: "var(--height-title-bar)" }}>
                <div className="titlebar-no-drag" style={{ width: "var(--width-traffic-light)" }} />
                <div className="flex-1">{sidebarTitleBar}</div>
              </div>
              {sidebarHeader && <div>{sidebarHeader}</div>}
              <div className="flex-1 overflow-y-auto py-1">{sidebarContent}</div>
            </aside>
          </>
        )}
      </div>

      <Footer
        sidebarVisible={visible && bp === "wide"}
        left={footerLeft}
        center={footerCenter}
        right={footerRight}
      />
    </div>
  );
}
