import { useCallback, useState, type ReactNode } from "react";
import { useViewportBreakpoint } from "./useViewportBreakpoint";
import { useShortcut } from "./useShortcut";
import { Footer } from "./Footer";
import { startWindowDragFromPointerEvent } from "./windowDrag";

type FooterLeftRender = (state: { sidebarVisible: boolean; toggleSidebar: () => void }) => ReactNode;

export type AppShellProps = {
  sidebarTitleBar?: ReactNode;
  sidebarHeader?: ReactNode;
  sidebarContent: ReactNode;
  /** Page identity zone in the main title bar (breadcrumb, title, count). */
  mainTitleBarStart: ReactNode;
  /** Optional action zone in the main title bar (settings cog, page-level buttons). */
  mainTitleBarEnd?: ReactNode;
  mainHeader?: ReactNode;
  mainContent: ReactNode;
  footerLeft?: ReactNode | FooterLeftRender;
  footerCenter?: ReactNode;
  footerRight?: ReactNode;
  scrollCollapse?: "none" | "y2" | "y1-y2";
};

export function AppShell({
  sidebarTitleBar,
  sidebarHeader,
  sidebarContent,
  mainTitleBarStart,
  mainTitleBarEnd,
  mainHeader,
  mainContent,
  footerLeft,
  footerCenter,
  footerRight,
}: AppShellProps) {
  // Wide-mode column visibility and narrow-mode overlay state are tracked
  // separately so resizing across the breakpoint does not bleed user-chosen
  // state between them. The spec requires "auto-collapse" below 900px, so
  // overlayOpen starts false and the overlay only appears after the user
  // opens it via `[` or the footer toggle.
  const [wideVisible, setWideVisible] = useState(true);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const bp = useViewportBreakpoint();

  const showInColumn = bp === "wide" && wideVisible;
  const overlay = bp === "narrow" && overlayOpen;
  const visible = bp === "wide" ? wideVisible : overlayOpen;

  const toggle = useCallback(() => {
    if (bp === "wide") setWideVisible((v) => !v);
    else setOverlayOpen((v) => !v);
  }, [bp]);

  useShortcut("[", toggle);

  const dismissOverlay = useCallback(() => {
    setOverlayOpen(false);
  }, []);
  useShortcut("escape", dismissOverlay, { enabled: overlay });

  const resolvedFooterLeft = typeof footerLeft === "function"
    ? footerLeft({ sidebarVisible: visible, toggleSidebar: toggle })
    : footerLeft;

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
              <div
                data-tauri-drag-region
                onPointerDown={startWindowDragFromPointerEvent}
                className="flex-1 bg-mantle"
              >
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
            <span className="titlebar-no-drag flex items-center gap-2 min-w-0">{mainTitleBarStart}</span>
            <div
              data-tauri-drag-region
              onPointerDown={startWindowDragFromPointerEvent}
              className="flex-1 min-w-0"
            />
            {mainTitleBarEnd && (
              <span className="titlebar-no-drag flex items-center gap-2">{mainTitleBarEnd}</span>
            )}
          </div>
          {mainHeader && (
            <div className="flex items-center px-3 border-b border-border/60" style={{ height: "var(--height-header-bar)" }}>
              <span className="titlebar-no-drag flex items-center gap-2 min-w-0 flex-1">{mainHeader}</span>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">{mainContent}</div>
        </section>

        {/* Overlay drawer (narrow + visible) */}
        {overlay && (
          <>
            <button
              type="button"
              aria-label="Dismiss sidebar"
              onClick={dismissOverlay}
              className="absolute inset-0 bg-crust/50 z-30 cursor-default"
            />
            <aside
              className="absolute top-0 left-0 bottom-0 bg-mantle flex flex-col border-r border-border z-40"
              style={{ width: "var(--width-sidebar)" }}
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
        left={resolvedFooterLeft}
        center={footerCenter}
        right={footerRight}
      />
    </div>
  );
}
