import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { CollectionHeader } from "./CollectionHeader";
import type { CollectionView } from "./views/types";

const views: CollectionView[] = [
  { id: "all", entityKind: "jira-issue", displayName: "All open", position: 0, isDefault: true, config: {} },
];

describe("CollectionHeader", () => {
  it("places chips and a live settings slot in one row", () => {
    render(
      <CollectionHeader
        views={views}
        activeViewId="all"
        onPick={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        settingsSlot={<button type="button">Open view settings</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "All open" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open view settings/i })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /view settings coming next/i })).not.toBeInTheDocument();
  });

  it("renders without settingsSlot when none provided", () => {
    render(
      <CollectionHeader
        views={views}
        activeViewId="all"
        onPick={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "All open" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /view settings/i })).not.toBeInTheDocument();
  });

  it("supports accessible rendering", async () => {
    const { container } = render(
      <CollectionHeader
        views={views}
        activeViewId="all"
        onPick={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        settingsSlot={<button type="button">Open view settings</button>}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
