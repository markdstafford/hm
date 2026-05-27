import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it, vi, beforeAll } from "vitest";
import { jiraIssueEntity } from "../../../../entities/jira-issue";
import { defaultViewConfig, patchViewConfig } from "../../ViewConfig";
import type { ViewConfig } from "../../ViewConfig";
import { FilterPanel } from "./FilterPanel";

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

const FIXTURE_ITEMS = [
  {
    work_item_id: "1",
    key: "AMP-1",
    title: "Bug fix",
    status_name: "Open",
    assignee_display_name: "Alice",
    updated_at_source: "2026-05-01",
    project_key: "AMP",
    priority_name: "High",
    labels: ["bug"],
  },
  {
    work_item_id: "2",
    key: "AMP-2",
    title: "Feature",
    status_name: "Done",
    assignee_display_name: "Bob",
    updated_at_source: "2026-04-01",
    project_key: "AMP",
    priority_name: "Low",
    labels: [],
  },
];

function renderPanel(config: ViewConfig = defaultViewConfig(jiraIssueEntity), onPatchConfig = vi.fn()) {
  return {
    onPatchConfig,
    ...render(
      <FilterPanel
        entity={jiraIssueEntity}
        items={FIXTURE_ITEMS as any}
        config={config}
        onPatchConfig={onPatchConfig}
        onBack={vi.fn()}
        onClose={vi.fn()}
      />,
    ),
  };
}

describe("FilterPanel", () => {
  it("renders Filter heading and empty state copy when no filters", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: "Filter" })).toBeInTheDocument();
    expect(screen.getByText("No filters yet. Add a filter to narrow this view.")).toBeInTheDocument();
  });

  it("+ Add filter button is enabled with filterable entity", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "+ Add filter" })).not.toBeDisabled();
  });

  it("Clear all filters not visible when no rows", () => {
    renderPanel();
    expect(screen.queryByRole("button", { name: "Clear all filters" })).not.toBeInTheDocument();
  });

  it("clicking + Add filter adds a row and patches config.filters", async () => {
    const user = userEvent.setup();
    const onPatchConfig = vi.fn();
    renderPanel(defaultViewConfig(jiraIssueEntity), onPatchConfig);

    await user.click(screen.getByRole("button", { name: "+ Add filter" }));

    expect(onPatchConfig).toHaveBeenCalledOnce();
    const call = onPatchConfig.mock.calls[0][0] as ViewConfig;
    expect(call.filters).toHaveLength(1);
    expect(call.filters[0].property).toBeTruthy();
    expect(call.filters[0].operator).toBeTruthy();
  });

  it("rendered row has property, operator, and remove controls", () => {
    const config = patchViewConfig(defaultViewConfig(jiraIssueEntity), {
      filters: [{ id: "f1", property: "title", operator: "contains", value: "", active: true }],
    });
    renderPanel(config);

    // Filter row
    expect(screen.getByTestId("filter-row-f1")).toBeInTheDocument();
    // Property popover trigger
    expect(screen.getByRole("button", { name: /filter property/i })).toBeInTheDocument();
    // Operator popover trigger
    expect(screen.getByRole("button", { name: /filter operator/i })).toBeInTheDocument();
    // Remove button
    expect(screen.getByRole("button", { name: /Remove .* filter/i })).toBeInTheDocument();
  });

  it("typing a text value patches filters[0].value", async () => {
    const user = userEvent.setup();
    const onPatchConfig = vi.fn();
    const config = patchViewConfig(defaultViewConfig(jiraIssueEntity), {
      filters: [{ id: "f1", property: "title", operator: "contains", value: "", active: true }],
    });
    renderPanel(config, onPatchConfig);

    const textInput = screen.getByRole("textbox", { name: "Filter value" });
    // Fire a single change event with "bug" to simulate a paste or controlled input
    await user.type(textInput, "b");

    expect(onPatchConfig).toHaveBeenCalled();
    const firstCall = onPatchConfig.mock.calls[0][0] as ViewConfig;
    expect(firstCall.filters[0].value).toBe("b");
    expect(firstCall.filters[0].id).toBe("f1");
  });

  it("empty/not-empty operator hides value control", () => {
    const config = patchViewConfig(defaultViewConfig(jiraIssueEntity), {
      filters: [{ id: "f1", property: "title", operator: "empty", value: null, active: true }],
    });
    renderPanel(config);

    expect(screen.queryByRole("textbox", { name: "Filter value" })).not.toBeInTheDocument();
  });

  it("removing one filter keeps other rows", async () => {
    const user = userEvent.setup();
    const onPatchConfig = vi.fn();
    const config = patchViewConfig(defaultViewConfig(jiraIssueEntity), {
      filters: [
        { id: "f1", property: "title", operator: "contains", value: "bug", active: true },
        { id: "f2", property: "key", operator: "contains", value: "AMP", active: true },
      ],
    });
    renderPanel(config, onPatchConfig);

    const removeButtons = screen.getAllByRole("button", { name: /Remove .* filter/i });
    await user.click(removeButtons[0]);

    expect(onPatchConfig).toHaveBeenCalledOnce();
    const call = onPatchConfig.mock.calls[0][0] as ViewConfig;
    expect(call.filters).toHaveLength(1);
    expect(call.filters[0].id).toBe("f2");
  });

  it("Clear all filters empties the rows and hides itself", async () => {
    const user = userEvent.setup();
    const onPatchConfig = vi.fn();
    const config = patchViewConfig(defaultViewConfig(jiraIssueEntity), {
      filters: [{ id: "f1", property: "title", operator: "contains", value: "bug", active: true }],
    });
    renderPanel(config, onPatchConfig);

    expect(screen.getByRole("button", { name: "Clear all filters" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));

    expect(onPatchConfig).toHaveBeenCalledOnce();
    const call = onPatchConfig.mock.calls[0][0] as ViewConfig;
    expect(call.filters).toHaveLength(0);
  });

  it("axe has no violations in empty state", async () => {
    const { container } = renderPanel();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("axe has no violations with one active row", async () => {
    const config = patchViewConfig(defaultViewConfig(jiraIssueEntity), {
      filters: [{ id: "f1", property: "title", operator: "contains", value: "bug", active: true }],
    });
    const { container } = renderPanel(config);
    expect(await axe(container)).toHaveNoViolations();
  });
});
