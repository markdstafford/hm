import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { ViewChips } from "./ViewChips";
import type { CollectionView } from "./views/types";

const views: CollectionView[] = [
  { id: "recent", entityKind: "jira-issue", displayName: "Recently updated", position: 2, isDefault: true, config: {} },
  { id: "all", entityKind: "jira-issue", displayName: "All open", position: 0, isDefault: true, config: {} },
  { id: "mine", entityKind: "jira-issue", displayName: "Mine", position: 1, isDefault: true, config: {} },
];

describe("ViewChips", () => {
  it("renders ordered view chips plus the create chip", () => {
    render(<ViewChips views={views} activeViewId="all" onPick={vi.fn()} onCreate={vi.fn()} />);
    const buttons = screen.getAllByRole("button").map((button) => button.textContent);
    expect(buttons).toEqual(["All open", "Mine", "Recently updated", "+"]);
  });

  it("marks the active chip with primary tone and aria-current", () => {
    render(<ViewChips views={views} activeViewId="mine" onPick={vi.fn()} onCreate={vi.fn()} />);
    const active = screen.getByRole("button", { name: "Mine" });
    expect(active).toHaveAttribute("aria-current", "true");
    expect(active).toHaveAttribute("data-active", "true");
    expect(active.className).toContain("bg-primary");
  });

  it("calls onPick when an inactive chip is clicked", () => {
    const onPick = vi.fn();
    render(<ViewChips views={views} activeViewId="all" onPick={onPick} onCreate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Mine" }));
    expect(onPick).toHaveBeenCalledWith("mine");
  });

  it("does not call onPick when the active chip is clicked", () => {
    const onPick = vi.fn();
    render(<ViewChips views={views} activeViewId="all" onPick={onPick} onCreate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "All open" }));
    expect(onPick).not.toHaveBeenCalled();
  });

  it("calls onCreate from the plus chip", () => {
    const onCreate = vi.fn();
    render(<ViewChips views={views} activeViewId="all" onPick={vi.fn()} onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: /create named view/i }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("supports accessible rendering", async () => {
    const { container } = render(<ViewChips views={views} activeViewId="all" onPick={vi.fn()} onCreate={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
