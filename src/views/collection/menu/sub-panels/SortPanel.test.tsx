import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it, vi, beforeAll } from "vitest";
import { jiraIssueEntity } from "../../../../entities/jira-issue";
import { defaultViewConfig, type ViewConfig } from "../../ViewConfig";
import type { EntityContract } from "../../types";
import { SortPanel } from "./SortPanel";

beforeAll(() => {
  (globalThis as any).PointerEvent = window.MouseEvent;
  if (!window.HTMLElement.prototype.hasPointerCapture)
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  if (!window.HTMLElement.prototype.releasePointerCapture)
    window.HTMLElement.prototype.releasePointerCapture = () => {};
  if (!window.HTMLElement.prototype.setPointerCapture)
    window.HTMLElement.prototype.setPointerCapture = () => {};
  if (!window.HTMLElement.prototype.scrollIntoView)
    window.HTMLElement.prototype.scrollIntoView = () => {};
});

const entity = jiraIssueEntity as EntityContract<unknown, string>;

function baseConfig(overrides: Partial<ViewConfig> = {}): ViewConfig {
  return { ...defaultViewConfig(jiraIssueEntity), ...overrides };
}

function renderPanel(config = baseConfig(), onPatchConfig = vi.fn()) {
  return {
    onPatchConfig,
    ...render(
      <SortPanel
        entity={entity}
        config={config}
        onPatchConfig={onPatchConfig}
        onBack={vi.fn()}
        onClose={vi.fn()}
      />,
    ),
  };
}

describe("SortPanel", () => {
  it("renders the empty state and add button when no sort is active", () => {
    renderPanel();

    expect(screen.getByRole("heading", { name: "Sort" })).toBeInTheDocument();
    expect(screen.getByText("No sort applied. Rows use the default order for this collection.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add sort" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Clear all sort" })).not.toBeInTheDocument();
  });

  it("adds the first unused sortable property and patches only sort", async () => {
    const user = userEvent.setup();
    const config = baseConfig({ sort: [] });
    const { onPatchConfig } = renderPanel(config);

    await user.click(screen.getByRole("button", { name: "+ Add sort" }));

    expect(onPatchConfig).toHaveBeenCalledWith({
      ...config,
      sort: [{ property: "key", direction: "asc" }],
    });
  });

  it("renders active sort rows with position, property picker, direction toggle, and remove", () => {
    renderPanel(baseConfig({ sort: [{ property: "status", direction: "asc" }] }));

    expect(screen.getByText("1.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reorder sort level 1" })).toHaveAttribute("data-drag-handle", "true");
    expect(screen.getByRole("combobox", { name: "Sort property for level 1" })).toHaveTextContent("Status");
    expect(screen.getByRole("button", { name: "Switch sort level 1 to descending" })).toHaveTextContent("↑ Asc");
    expect(screen.getByRole("button", { name: "Remove Status sort" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear all sort" })).toBeInTheDocument();
  });

  it("toggles direction from asc to desc", async () => {
    const user = userEvent.setup();
    const config = baseConfig({ sort: [{ property: "status", direction: "asc" }] });
    const { onPatchConfig } = renderPanel(config);

    await user.click(screen.getByRole("button", { name: "Switch sort level 1 to descending" }));

    expect(onPatchConfig).toHaveBeenCalledWith({
      ...config,
      sort: [{ property: "status", direction: "desc" }],
    });
  });

  it("removes one level and preserves the rest", async () => {
    const user = userEvent.setup();
    const config = baseConfig({
      sort: [
        { property: "status", direction: "asc" },
        { property: "updated_at_source", direction: "desc" },
      ],
    });
    const { onPatchConfig } = renderPanel(config);

    await user.click(screen.getByRole("button", { name: "Remove Status sort" }));

    expect(onPatchConfig).toHaveBeenCalledWith({
      ...config,
      sort: [{ property: "updated_at_source", direction: "desc" }],
    });
  });

  it("clears all sort levels", async () => {
    const user = userEvent.setup();
    const config = baseConfig({ sort: [{ property: "status", direction: "asc" }] });
    const { onPatchConfig } = renderPanel(config);

    await user.click(screen.getByRole("button", { name: "Clear all sort" }));

    expect(onPatchConfig).toHaveBeenCalledWith({ ...config, sort: [] });
  });

  it("disables add when every sortable property is used", () => {
    const allUsed = (jiraIssueEntity.sortableProperties ?? []).map((row) => ({
      property: String(row.property),
      direction: "asc" as const,
    }));
    renderPanel(baseConfig({ sort: allUsed }));

    expect(screen.getByRole("button", { name: "+ Add sort" })).toBeDisabled();
    expect(screen.getByText("All sortable properties are already used.")).toBeInTheDocument();
  });

  it("property picker excludes properties used by other rows", async () => {
    const user = userEvent.setup();
    renderPanel(
      baseConfig({
        sort: [
          { property: "status", direction: "asc" },
          { property: "updated_at_source", direction: "desc" },
        ],
      }),
    );

    await user.click(screen.getByRole("combobox", { name: "Sort property for level 1" }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByText("Status")).toBeInTheDocument();
    expect(within(listbox).queryByText("Updated")).not.toBeInTheDocument();
  });

  it("shows a safe empty capability message when the entity has no sortable properties", () => {
    const noSortEntity = { ...entity, sortableProperties: [] };
    render(
      <SortPanel entity={noSortEntity} config={baseConfig()} onPatchConfig={vi.fn()} onBack={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.getByText("No sortable properties available for this collection.")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = renderPanel(baseConfig({ sort: [{ property: "status", direction: "asc" }] }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
