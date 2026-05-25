import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "jest-axe";
import { AppShell } from "./AppShell";

function harness(extra: Partial<React.ComponentProps<typeof AppShell>> = {}) {
  return render(
    <AppShell
      sidebarTitleBar={null}
      sidebarHeader={<div>SH</div>}
      sidebarContent={<div>SC</div>}
      mainTitleBarStart={<div>MTB</div>}
      mainHeader={<div>MH</div>}
      mainContent={<div>MC</div>}
      footerLeft={<span>FL</span>}
      footerCenter={<span>FC</span>}
      footerRight={<span>FR</span>}
      {...extra}
    />,
  );
}

describe("AppShell", () => {
  it("renders all zones", () => {
    harness();
    expect(screen.getByText("SH")).toBeInTheDocument();
    expect(screen.getByText("MC")).toBeInTheDocument();
    expect(screen.getByText("FC")).toBeInTheDocument();
  });
  it("hides sidebar when `[` is pressed", () => {
    const { container } = harness();
    fireEvent.keyDown(window, { key: "[" });
    // After toggling, the data-sidebar-visible attribute should be unset (undefined renders no attr)
    expect(container.querySelector('[data-sidebar-visible="true"]')).toBeNull();
  });
  it("has no axe violations", async () => {
    const { container } = harness();
    expect(await axe(container)).toHaveNoViolations();
  });
  it("wires drag region on title-bar spacers", () => {
    const { container } = harness();
    const spacers = container.querySelectorAll("[data-tauri-drag-region]");
    expect(spacers.length).toBeGreaterThanOrEqual(2);
  });
  it("places a drag spacer between mainTitleBarStart and mainTitleBarEnd", () => {
    const { container } = harness({
      mainTitleBarStart: <span data-testid="start">start</span>,
      mainTitleBarEnd: <span data-testid="end">end</span>,
    });
    const start = container.querySelector('[data-testid="start"]')!;
    const end = container.querySelector('[data-testid="end"]')!;
    // The start and end nodes both live inside titlebar-no-drag islands; a
    // data-tauri-drag-region sibling must sit between them in source order.
    const compare = start.compareDocumentPosition(end);
    expect(compare & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const spacers = Array.from(container.querySelectorAll("[data-tauri-drag-region]"));
    const between = spacers.some((sp) => {
      const afterStart = start.compareDocumentPosition(sp) & Node.DOCUMENT_POSITION_FOLLOWING;
      const beforeEnd = end.compareDocumentPosition(sp) & Node.DOCUMENT_POSITION_PRECEDING;
      return afterStart && beforeEnd;
    });
    expect(between).toBe(true);
  });
});

describe("AppShell narrow mode", () => {
  beforeEach(() => {
    window.matchMedia = ((q: string) => ({
      matches: q.includes("max-width: 899px"),
      media: q, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    // restore the broader test setup's stub
    window.matchMedia = ((q: string) => ({
      matches: false, media: q, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });

  it("auto-collapses on mount and does not open the overlay", () => {
    harness();
    expect(screen.queryByRole("button", { name: "Dismiss sidebar" })).toBeNull();
  });

  it("[ opens the overlay in narrow mode", () => {
    harness();
    fireEvent.keyDown(window, { key: "[" });
    expect(screen.getByRole("button", { name: "Dismiss sidebar" })).toBeInTheDocument();
  });

  it("clicking the dim backing dismisses the overlay", () => {
    harness();
    fireEvent.keyDown(window, { key: "[" });
    const dismiss = screen.getByRole("button", { name: "Dismiss sidebar" });
    fireEvent.click(dismiss);
    expect(screen.queryByRole("button", { name: "Dismiss sidebar" })).toBeNull();
  });

  it("Escape dismisses the overlay only when it is open", () => {
    harness();
    // Escape without opening should be a no-op (the global Escape binding is
    // gated by `enabled: overlay`).
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Dismiss sidebar" })).toBeNull();
    // Open, then Escape.
    fireEvent.keyDown(window, { key: "[" });
    expect(screen.getByRole("button", { name: "Dismiss sidebar" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Dismiss sidebar" })).toBeNull();
  });
});
