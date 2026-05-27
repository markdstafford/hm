import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { CollectionHeader } from "./CollectionHeader";
import type { CollectionView } from "./views/types";

const views: CollectionView[] = [
  { id: "all", entityKind: "jira-issue", displayName: "All open", position: 0, isDefault: true, config: {} },
];

describe("CollectionHeader", () => {
  it("places chips and disabled settings placeholder in one row", () => {
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
    const settings = screen.getByRole("button", { name: /view settings coming next/i });
    expect(settings).toHaveAttribute("aria-disabled", "true");
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
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
