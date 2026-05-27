import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { jiraIssueEntity } from "../../../../entities/jira-issue";
import { defaultViewConfig } from "../../ViewConfig";
import type { EntityContract } from "../../types";
import { PropertyVisibilityPanel } from "./PropertyVisibilityPanel";

// Cast to EntityContract<unknown, string> — the panel is generic and works with any entity
const entity = jiraIssueEntity as EntityContract<unknown, string>;

function renderPanel(overrides?: Partial<Parameters<typeof PropertyVisibilityPanel>[0]>) {
  return render(
    <PropertyVisibilityPanel
      entity={entity}
      config={defaultViewConfig(jiraIssueEntity)}
      onPatchConfig={vi.fn()}
      onBack={vi.fn()}
      onClose={vi.fn()}
      {...overrides}
    />,
  );
}

describe("PropertyVisibilityPanel", () => {
  it("renders header, search input, shown section, and hidden section", () => {
    renderPanel();

    expect(screen.getByRole("heading", { name: "Property visibility" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Search properties" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Shown" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hidden" })).toBeInTheDocument();
  });

  it("renders one row per property with handle, side controls, and visibility control", () => {
    renderPanel();

    expect(screen.getByRole("button", { name: "Reorder Title" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Title left" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Move Title right" })).toHaveAttribute("aria-pressed", "false");
    // Title eye button: always visible = disabled
    expect(screen.getByRole("button", { name: "Title is always visible" })).toHaveAttribute("aria-disabled", "true");
    // Priority is hidden by default
    expect(screen.getByRole("button", { name: "Show Priority" })).toBeInTheDocument();
  });

  it("filters rows by case-insensitive property label and shows section empty text", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByRole("textbox", { name: "Search properties" }), "priority");

    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.queryByText("Title")).not.toBeInTheDocument();
    // Priority is hidden, so Shown section should show empty text
    expect(screen.getByText("No shown properties match")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = renderPanel();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("hiding a non-title property patches only propertyVisibility", async () => {
    const user = userEvent.setup();
    const onPatchConfig = vi.fn();
    const config = defaultViewConfig(jiraIssueEntity);
    render(
      <PropertyVisibilityPanel
        entity={entity}
        config={config}
        onPatchConfig={onPatchConfig}
        onBack={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Hide Key" }));

    expect(onPatchConfig).toHaveBeenCalledWith({
      ...config,
      propertyVisibility: config.propertyVisibility.map((row) =>
        row.property === "key" ? { ...row, visible: false } : row,
      ),
    });
  });

  it("showing a hidden property patches it visible without moving its canonical index", async () => {
    const user = userEvent.setup();
    const onPatchConfig = vi.fn();
    const config = defaultViewConfig(jiraIssueEntity);
    render(
      <PropertyVisibilityPanel
        entity={entity}
        config={config}
        onPatchConfig={onPatchConfig}
        onBack={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Show Priority" }));

    const patched = onPatchConfig.mock.calls[0][0];
    expect(patched.propertyVisibility.map((row: { property: string }) => row.property)).toEqual(
      config.propertyVisibility.map((row) => row.property),
    );
    expect(patched.propertyVisibility.find((row: { property: string }) => row.property === "priority").visible).toBe(true);
  });

  it("does not patch when the title visibility button is clicked", async () => {
    const user = userEvent.setup();
    const onPatchConfig = vi.fn();
    render(
      <PropertyVisibilityPanel
        entity={entity}
        config={defaultViewConfig(jiraIssueEntity)}
        onPatchConfig={onPatchConfig}
        onBack={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Title is always visible" }));

    expect(onPatchConfig).not.toHaveBeenCalled();
  });

  it("marks drag handles with data-drag-handle='true'", () => {
    renderPanel();

    const handle = screen.getByRole("button", { name: "Reorder Key" });
    expect(handle).toHaveAttribute("data-drag-handle", "true");
  });

  it("keeps drag disabled while search is active and shows explanation text", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByRole("textbox", { name: "Search properties" }), "key");

    expect(screen.getByText("Clear search to reorder properties.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reorder Key" })).toHaveAttribute("aria-disabled", "true");
  });

  it("changing side patches only the selected row side and preserves order and unrelated config", async () => {
    const user = userEvent.setup();
    const onPatchConfig = vi.fn();
    const config = defaultViewConfig(jiraIssueEntity);
    render(
      <PropertyVisibilityPanel
        entity={entity}
        config={config}
        onPatchConfig={onPatchConfig}
        onBack={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Move Priority left" }));

    const patched = onPatchConfig.mock.calls[0][0];
    expect(patched.propertyVisibility.map((row: { property: string }) => row.property)).toEqual(
      config.propertyVisibility.map((row) => row.property),
    );
    expect(patched.propertyVisibility.find((row: { property: string }) => row.property === "priority").side).toBe("left");
    expect(patched.layout).toEqual(config.layout);
    expect(patched.sort).toEqual(config.sort);
    expect(patched.group).toEqual(config.group);
    expect(patched.filters).toEqual(config.filters);
  });
});
