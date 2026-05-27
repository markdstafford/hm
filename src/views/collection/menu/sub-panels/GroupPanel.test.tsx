import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeAll, describe, it, expect } from "vitest";
import { GroupPanel } from "./GroupPanel";
import { defaultViewConfig } from "../../ViewConfig";
import { jiraIssueEntity } from "../../../../entities/jira-issue";

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

describe("GroupPanel", () => {
  it("renders controls and hides Remove grouping when inactive", () => {
    render(
      <GroupPanel
        entity={jiraIssueEntity}
        config={defaultViewConfig(jiraIssueEntity)}
        onPatchConfig={vi.fn()}
        onBack={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Group" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /group by none/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Hide empty groups")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove grouping/i })).not.toBeInTheDocument();
  });

  it("renders exactly one visible 'Hide empty groups' label text in the row", () => {
    render(
      <GroupPanel
        entity={jiraIssueEntity}
        config={defaultViewConfig(jiraIssueEntity)}
        onPatchConfig={vi.fn()}
        onBack={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // getByText finds visible text nodes; sr-only content is still in DOM but
    // the label in the row and the switch's sr-only span both contain the text.
    // We verify there is exactly one visible (non-sr-only) instance.
    const allTextNodes = screen.getAllByText("Hide empty groups");
    const visibleNodes = allTextNodes.filter(
      (el) => !el.classList.contains("sr-only"),
    );
    expect(visibleNodes).toHaveLength(1);
  });

  it("patches only group.property when choosing a property via the popover", async () => {
    const user = userEvent.setup();
    const config = defaultViewConfig(jiraIssueEntity);
    const onPatchConfig = vi.fn();
    render(
      <GroupPanel
        entity={jiraIssueEntity}
        config={config}
        onPatchConfig={onPatchConfig}
        onBack={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /group by none/i }));
    await user.click(screen.getByRole("option", { name: /status/i }));

    expect(onPatchConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        group: { property: "status", hideEmptyGroups: true },
      }),
    );
    // Ensure other config fields are preserved
    const call = onPatchConfig.mock.calls[0][0];
    expect(call.propertyVisibility).toEqual(config.propertyVisibility);
    expect(call.sort).toEqual(config.sort);
  });

  it("toggles hide empty groups without clearing the group property", async () => {
    const user = userEvent.setup();
    const config = { ...defaultViewConfig(jiraIssueEntity), group: { property: "status", hideEmptyGroups: true } };
    const onPatchConfig = vi.fn();
    render(
      <GroupPanel entity={jiraIssueEntity} config={config} onPatchConfig={onPatchConfig} onBack={vi.fn()} onClose={vi.fn()} />,
    );

    await user.click(screen.getByLabelText("Hide empty groups"));
    expect(onPatchConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        group: { property: "status", hideEmptyGroups: false },
      }),
    );
  });

  it("shows Remove grouping when active, and clicking it clears the property", async () => {
    const user = userEvent.setup();
    const config = { ...defaultViewConfig(jiraIssueEntity), group: { property: "status", hideEmptyGroups: true } };
    const onPatchConfig = vi.fn();
    render(
      <GroupPanel entity={jiraIssueEntity} config={config} onPatchConfig={onPatchConfig} onBack={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: /remove grouping/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /remove grouping/i }));
    expect(onPatchConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        group: { property: null, hideEmptyGroups: true },
      }),
    );
  });
});
