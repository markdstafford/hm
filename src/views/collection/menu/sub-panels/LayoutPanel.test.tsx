import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { LayoutPanel } from "./LayoutPanel";
import { normalizeViewConfig } from "../../ViewConfig";
import { jiraIssueEntity } from "../../../../entities/jira-issue";

beforeAll(() => {
  (globalThis as any).PointerEvent = window.MouseEvent;
  if (!window.HTMLElement.prototype.hasPointerCapture) window.HTMLElement.prototype.hasPointerCapture = () => false;
  if (!window.HTMLElement.prototype.releasePointerCapture) window.HTMLElement.prototype.releasePointerCapture = () => {};
  if (!window.HTMLElement.prototype.setPointerCapture) window.HTMLElement.prototype.setPointerCapture = () => {};
});

function renderPanel(configInput: unknown = {}) {
  const onPatchConfig = vi.fn();
  const config = normalizeViewConfig(configInput, jiraIssueEntity);
  const result = render(
    <LayoutPanel
      config={config}
      onPatchConfig={onPatchConfig}
      onBack={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  return { ...result, onPatchConfig, config };
}

describe("LayoutPanel", () => {
  it("renders the Layout heading, Type section, Display section, and Preview row", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: "Layout" })).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Display")).toBeInTheDocument();
    for (const label of ["Table", "Board", "List", "Gallery", "Timeline", "Calendar"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("marks Table as selected (aria-pressed=true) and all other tiles as disabled", () => {
    renderPanel();
    // Table button: aria-pressed=true, NOT aria-disabled
    const tableBtn = screen.getByRole("button", { name: /table/i, hidden: false });
    expect(tableBtn).toHaveAttribute("aria-pressed", "true");

    // Future layout tiles: aria-disabled=true
    for (const label of ["Board", "List", "Gallery", "Timeline", "Calendar"]) {
      const btn = screen.getByText(label).closest("button")!;
      expect(btn).toHaveAttribute("aria-disabled", "true");
    }
  });

  it("clicking a disabled layout tile does not call onPatchConfig", async () => {
    const user = userEvent.setup();
    const { onPatchConfig } = renderPanel();
    const boardBtn = screen.getByText("Board").closest("button")!;
    await user.click(boardBtn);
    expect(onPatchConfig).not.toHaveBeenCalled();
  });

  it("density toggle shows Regular pressed by default", () => {
    renderPanel();
    // Find buttons by text within a density section — look for Compact and Regular buttons
    expect(screen.getByRole("button", { name: /compact/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /regular/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("clicking Compact patches layout.density to compact and preserves other config", async () => {
    const user = userEvent.setup();
    const { onPatchConfig, config } = renderPanel();
    await user.click(screen.getByRole("button", { name: /compact/i }));
    expect(onPatchConfig).toHaveBeenCalledWith({
      ...config,
      layout: { ...config.layout, density: "compact" },
    });
  });

  it("clicking Regular when already regular does not patch config", async () => {
    const user = userEvent.setup();
    const { onPatchConfig } = renderPanel(); // default is regular
    await user.click(screen.getByRole("button", { name: /regular/i }));
    expect(onPatchConfig).not.toHaveBeenCalled();
  });

  it("shows current preview label in the Preview row", () => {
    renderPanel({ layout: { density: "regular", preview: "bottom-peek" } });
    expect(screen.getByText("Bottom")).toBeInTheDocument();
  });

  it("clicking a preview option patches layout.preview and preserves other config", async () => {
    const user = userEvent.setup();
    const { onPatchConfig, config } = renderPanel();
    // Click the Preview row trigger button to open the popover
    await user.click(screen.getByRole("button", { name: /preview/i }));
    // Pick "Bottom" from the popover
    await user.click(screen.getByRole("option", { name: /bottom/i }));
    expect(onPatchConfig).toHaveBeenCalledWith({
      ...config,
      layout: { ...config.layout, preview: "bottom-peek" },
    });
  });

  it("has no axe violations", async () => {
    const { container } = renderPanel();
    expect(await axe(container)).toHaveNoViolations();
  });
});
