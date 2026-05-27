import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, beforeAll, describe, it, expect } from "vitest";
import { axe } from "jest-axe";
import userEvent from "@testing-library/user-event";
import { ViewSettingsMenu } from "./ViewSettingsMenu";
import type { ViewSettingsMenuProps } from "./ViewSettingsMenu";
import { jiraIssueEntity } from "../../../entities/jira-issue";
import type { JiraIssueListItem } from "../../../bindings";
import type { JiraIssueProperty } from "../../../entities/jira-issue/properties";
import type { CollectionView } from "../views/types";

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

const activeView: CollectionView = {
  id: "jira-issue-mine",
  entityKind: "jira-issue",
  displayName: "Mine",
  position: 1,
  isDefault: true,
  config: {},
};

type JiraMenuProps = ViewSettingsMenuProps<JiraIssueListItem, JiraIssueProperty>;

function renderMenu(props: Partial<JiraMenuProps> = {}) {
  return render(
    <ViewSettingsMenu
      activeView={activeView}
      entity={jiraIssueEntity}
      onRenameView={vi.fn()}
      onPatchConfig={vi.fn()}
      {...props}
    />,
  );
}

describe("ViewSettingsMenu", () => {
  it("trigger has accessible name 'Open view settings'", () => {
    renderMenu();
    expect(screen.getByRole("button", { name: "Open view settings" })).toBeInTheDocument();
  });

  it("opening shows View settings heading, View name input, and all category rows", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "Open view settings" }));
    expect(screen.getByRole("heading", { name: "View settings" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "View name" })).toHaveValue("Mine");
    const rows = ["Layout", "Property visibility", "Sort", "Group", "Filter", "Conditional color"];
    for (const row of rows) {
      expect(screen.getByText(row)).toBeInTheDocument();
    }
  });

  it("rows show correct summary values", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "Open view settings" }));
    expect(screen.getByText("Table · Regular")).toBeInTheDocument();
    expect(screen.getByText("5 of 8")).toBeInTheDocument();
    // Sort, Group, Filter all show "None"
    const noneElements = screen.getAllByText("None");
    expect(noneElements.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("Soon")).toBeInTheDocument();
  });

  it("clicking Layout opens layout panel with real controls", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "Open view settings" }));
    await user.click(screen.getByText("Layout").closest("button")!);
    expect(screen.getByRole("heading", { name: "Layout" })).toBeInTheDocument();
    expect(screen.getByText("Table")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /regular/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("layout density change calls onPatchConfig with active view id and compact density", async () => {
    const user = userEvent.setup();
    const onPatchConfig = vi.fn();
    renderMenu({ onPatchConfig });
    await user.click(screen.getByRole("button", { name: "Open view settings" }));
    await user.click(screen.getByText("Layout").closest("button")!);
    await user.click(screen.getByRole("button", { name: /compact/i }));

    expect(onPatchConfig).toHaveBeenCalledWith(
      "jira-issue-mine",
      expect.objectContaining({
        layout: expect.objectContaining({ density: "compact", preview: "side-peek", type: "table" }),
      }),
    );
  });

  it("clicking Property visibility opens functional property controls", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "Open view settings" }));
    await user.click(screen.getByText("Property visibility").closest("button")!);

    expect(screen.getByRole("heading", { name: "Property visibility" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Search properties" })).toBeInTheDocument();
    expect(screen.queryByText("Coming in #41")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reorder Title" })).toBeInTheDocument();
  });

  it("clicking Sort opens Sort panel", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "Open view settings" }));
    // "Sort" text appears multiple times (row label + possible elsewhere); use the one inside a button
    await user.click(screen.getByText("Sort").closest("button")!);
    expect(screen.getByRole("heading", { name: "Sort" })).toBeInTheDocument();
    expect(screen.getByText("Coming in #42")).toBeInTheDocument();
  });

  it("clicking Group opens Group panel", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "Open view settings" }));
    await user.click(screen.getByText("Group").closest("button")!);
    expect(screen.getByRole("heading", { name: "Group" })).toBeInTheDocument();
    expect(screen.getByText("Coming in #43")).toBeInTheDocument();
  });

  it("clicking Filter opens Filter panel", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "Open view settings" }));
    await user.click(screen.getByText("Filter").closest("button")!);
    expect(screen.getByRole("heading", { name: "Filter" })).toBeInTheDocument();
    expect(screen.getByText("Coming in #44")).toBeInTheDocument();
  });

  it("Conditional color row is disabled and does not navigate", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "Open view settings" }));
    // The disabled row is a div with aria-disabled, not a button; clicking should not navigate
    const conditionalColorLabel = screen.getByText("Conditional color");
    fireEvent.click(conditionalColorLabel);
    // Top sheet heading should still be visible
    expect(screen.getByRole("heading", { name: "View settings" })).toBeInTheDocument();
  });

  it("back arrow in a sub-panel returns to top sheet", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "Open view settings" }));
    await user.click(screen.getByText("Layout").closest("button")!);
    expect(screen.getByRole("heading", { name: "Layout" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to view settings" }));
    expect(screen.getByRole("heading", { name: "View settings" })).toBeInTheDocument();
  });

  it("close button dismisses menu", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "Open view settings" }));
    expect(screen.getByRole("heading", { name: "View settings" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close view settings" }));
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "View settings" })).not.toBeInTheDocument();
    });
  });

  it("Escape key dismisses menu", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "Open view settings" }));
    expect(screen.getByRole("heading", { name: "View settings" })).toBeInTheDocument();
    // Focus an element inside the popover then press Escape via userEvent
    const input = screen.getByRole("textbox", { name: "View name" });
    await user.click(input);
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "View settings" })).not.toBeInTheDocument();
    });
  });

  it("outside click dismisses menu", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "Open view settings" }));
    expect(screen.getByRole("heading", { name: "View settings" })).toBeInTheDocument();
    await user.click(document.body);
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "View settings" })).not.toBeInTheDocument();
    });
  });

  it("has no axe violations when open", async () => {
    const user = userEvent.setup();
    const { container } = renderMenu();
    await user.click(screen.getByRole("button", { name: "Open view settings" }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it("rename: change input and press Enter calls onRenameView", async () => {
    const user = userEvent.setup();
    const onRenameView = vi.fn();
    renderMenu({ onRenameView });
    await user.click(screen.getByRole("button", { name: "Open view settings" }));
    const input = screen.getByRole("textbox", { name: "View name" });
    await user.clear(input);
    await user.type(input, "My new name");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRenameView).toHaveBeenCalledWith("jira-issue-mine", "My new name");
  });

  it("rename: failed onRenameView restores draft to last saved name and shows error", async () => {
    const user = userEvent.setup();
    const onRenameView = vi.fn().mockRejectedValue(new Error("save failed"));
    renderMenu({ onRenameView });
    await user.click(screen.getByRole("button", { name: "Open view settings" }));
    const input = screen.getByRole("textbox", { name: "View name" });
    await user.clear(input);
    await user.type(input, "New name that fails");
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "View name" })).toHaveValue("Mine");
    });
    expect(screen.getByText("Could not save view name")).toBeInTheDocument();
  });

  it("rename: blank name shows error", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "Open view settings" }));
    const input = screen.getByRole("textbox", { name: "View name" });
    await user.clear(input);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("View name cannot be blank")).toBeInTheDocument();
  });

  it("active-view change closes the menu", async () => {
    const user = userEvent.setup();
    const { rerender } = renderMenu();
    await user.click(screen.getByRole("button", { name: "Open view settings" }));
    expect(screen.getByRole("heading", { name: "View settings" })).toBeInTheDocument();
    const differentView: CollectionView = {
      ...activeView,
      id: "jira-issue-all-open",
      displayName: "All open",
    };
    rerender(
      <ViewSettingsMenu
        activeView={differentView}
        entity={jiraIssueEntity}
        onRenameView={vi.fn()}
        onPatchConfig={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "View settings" })).not.toBeInTheDocument();
    });
  });
});
