import { describe, it, expect } from "vitest";
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
      mainTitleBar={<div>MTB</div>}
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
});
