import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeAll, describe, it, expect } from "vitest";
import { GroupByPopover } from "./GroupByPopover";
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

describe("GroupByPopover", () => {
  it("lists None first, then groupable properties, and marks the current value selected", async () => {
    const user = userEvent.setup();
    render(
      <GroupByPopover
        groupableProperties={jiraIssueEntity.groupableProperties ?? []}
        entity={jiraIssueEntity}
        value="status"
        onSelect={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /group by status/i }));

    const options = screen.getAllByRole("option");
    expect(options[0].textContent).toContain("None");
    expect(options.some((o) => o.textContent?.includes("Status"))).toBe(true);
    expect(options.some((o) => o.textContent?.includes("Assignee"))).toBe(true);
    expect(screen.getByRole("option", { name: /status/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /none/i })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onSelect with property id when a property is chosen", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <GroupByPopover
        groupableProperties={jiraIssueEntity.groupableProperties ?? []}
        entity={jiraIssueEntity}
        value={null}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("button", { name: /group by none/i }));
    await user.click(screen.getByRole("option", { name: /status/i }));
    expect(onSelect).toHaveBeenCalledWith("status");
  });

  it("calls onSelect with null when None is chosen", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <GroupByPopover
        groupableProperties={jiraIssueEntity.groupableProperties ?? []}
        entity={jiraIssueEntity}
        value="status"
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("button", { name: /group by status/i }));
    await user.click(screen.getByRole("option", { name: /^none$/i }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
