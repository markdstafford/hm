import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import type { EntityPreviewMetadata, PreviewFieldConfig, PreviewFieldDefinition } from "../types";
import { PreviewFields } from "./PreviewFields";

type Property = "priority" | "assignee" | "labels" | "updated" | "team" | "empty";
type Item = {
  priority?: string | null;
  assignee?: string | null;
  labels?: string[];
  updated?: string | null;
  team?: string | null;
  empty?: string | null;
};

const definitions: PreviewFieldDefinition<Item, Property>[] = [
  {
    property: "priority",
    label: "Priority",
    isEmpty: (item) => !item.priority?.trim(),
    renderCell: ({ item }) => <span data-testid="priority-cell">{item.priority}</span>,
  },
  {
    property: "assignee",
    label: "Assignee",
    isEmpty: (item) => !item.assignee?.trim(),
    renderCell: ({ item }) => <span>{item.assignee}</span>,
  },
  {
    property: "labels",
    label: "Labels",
    isEmpty: (item) => !item.labels?.length,
    renderCell: ({ item }) => <span>{item.labels?.join(", ")}</span>,
  },
  {
    property: "updated",
    label: "Updated",
    isEmpty: (item) => !item.updated?.trim(),
    renderCell: ({ item }) => <span>{item.updated}</span>,
  },
  {
    property: "team",
    label: "Team",
    isEmpty: (item) => !item.team?.trim(),
    renderCell: ({ item }) => <span>{item.team}</span>,
    pinEligible: true,
  },
  {
    property: "empty",
    label: "Empty",
    isEmpty: (item) => !item.empty?.trim(),
    renderCell: ({ item }) => <span>{item.empty}</span>,
  },
];

const config: PreviewFieldConfig<Property>[] = [
  { property: "priority", tier: 1 },
  { property: "assignee", tier: 1 },
  { property: "labels", tier: 2 },
  { property: "updated", tier: 3 },
  { property: "team", tier: 2, pinned: true },
  { property: "empty", tier: 2 },
];

const item: Item = {
  priority: "P1",
  assignee: "Elena",
  labels: ["ui", "preview"],
  updated: "2h ago",
  team: "Platform",
  empty: "   ",
};

const roomyPreview: EntityPreviewMetadata = {
  surface: "bottom-peek",
  width: 720,
  height: 400,
  sizeClass: "roomy",
};

const compactPreview: EntityPreviewMetadata = {
  surface: "side-peek",
  width: 360,
  height: null,
  sizeClass: "compact",
};

describe("PreviewFields", () => {
  it("renders populated tier 1 fields inline, promotes pinned fields, and hides empty fields", () => {
    render(<PreviewFields item={item} definitions={definitions} config={config} preview={compactPreview} />);

    const region = screen.getByRole("region", { name: "Issue fields" });
    expect(region).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByTestId("priority-cell")).toHaveTextContent("P1");
    expect(screen.getByText("Assignee")).toBeInTheDocument();
    expect(screen.getByText("Pinned Team")).toBeInTheDocument();
    expect(screen.getByText("Platform")).toBeInTheDocument();
    expect(screen.queryByText("Empty")).not.toBeInTheDocument();
  });

  it("renders secondary fields only after expanding More fields with populated count", async () => {
    const user = userEvent.setup();
    render(<PreviewFields item={item} definitions={definitions} config={config} preview={roomyPreview} />);

    const button = screen.getByRole("button", { name: "More fields (2)" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Labels")).not.toBeInTheDocument();

    await user.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Labels")).toBeInTheDocument();
    expect(screen.getByText("ui, preview")).toBeInTheDocument();
    expect(screen.getByText("Updated")).toBeInTheDocument();
    expect(screen.getByText("2h ago")).toBeInTheDocument();
  });

  it("omits the disclosure when no secondary fields are populated", () => {
    render(
      <PreviewFields
        item={{ priority: "P1", assignee: "Elena", team: "Platform", labels: [], updated: null, empty: null }}
        definitions={definitions}
        config={config}
        preview={compactPreview}
      />,
    );

    expect(screen.queryByRole("button", { name: /More fields/ })).not.toBeInTheDocument();
  });

  it("uses one secondary column for compact metadata and two for roomy measured width", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PreviewFields item={item} definitions={definitions} config={config} preview={compactPreview} />);

    await user.click(screen.getByRole("button", { name: "More fields (2)" }));
    expect(screen.getByTestId("preview-secondary-fields")).toHaveClass("grid-cols-1");

    rerender(<PreviewFields item={item} definitions={definitions} config={config} preview={roomyPreview} />);
    await user.click(screen.getByRole("button", { name: "More fields (2)" }));
    const secondary = screen.getByTestId("preview-secondary-fields");
    expect(secondary).toHaveClass("grid-cols-2");
    expect(secondary).not.toHaveClass("sm:grid-cols-2");
  });

  it("has no axe violations when collapsed or expanded", async () => {
    const user = userEvent.setup();
    const { container } = render(<PreviewFields item={item} definitions={definitions} config={config} preview={roomyPreview} />);
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole("button", { name: "More fields (2)" }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
