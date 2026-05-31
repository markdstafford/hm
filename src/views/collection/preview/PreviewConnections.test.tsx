import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { PreviewConnections } from "./PreviewConnections";
import type { CollectionEdge } from "../navigation/types";

type Item = { id: string; key: string; title: string };

const target: Item = { id: "2", key: "AMP-1102", title: "Consolidate sync retries" };

const edges: CollectionEdge<Item>[] = [
  {
    id: "duplicates:AMP-1102",
    kind: "source",
    shape: "single",
    relationship: "duplicates",
    targetRef: { entityId: "jira-issue", displayKey: "AMP-1102", title: "Consolidate sync retries" },
    target,
  },
  {
    id: "similar:AMP-800",
    kind: "suggested",
    shape: "single",
    relationship: "similar",
    confidence: 0.83,
    targetRef: { entityId: "jira-issue", displayKey: "AMP-800", title: "Deprecate LSP from JSCA" },
    target: { id: "3", key: "AMP-800", title: "Deprecate LSP from JSCA" },
  },
  {
    id: "related:set",
    kind: "local",
    shape: "set",
    relationship: "all related",
    label: "all related issues",
    count: 2,
    items: [target, { id: "3", key: "AMP-800", title: "Deprecate LSP from JSCA" }],
  },
  {
    id: "blocks:SEC-441",
    kind: "source",
    shape: "single",
    relationship: "blocks",
    danglingReason: "not-ingested",
    targetRef: { entityId: "jira-issue", displayKey: "SEC-441", title: "External secret rotation" },
  },
];

describe("PreviewConnections", () => {
  it("renders nothing when there are no edges", () => {
    const { container } = render(<PreviewConnections edges={[]} onOpenSingle={vi.fn()} onOpenSet={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders single-target, set-target, suggested confidence, and dangling rows", () => {
    render(<PreviewConnections edges={edges} onOpenSingle={vi.fn()} onOpenSet={vi.fn()} />);
    expect(screen.getByRole("region", { name: "Connections" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open duplicates AMP-1102" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open all related issues, 2 items" })).toBeInTheDocument();
    expect(screen.getByText("83% related")).toBeInTheDocument();
    expect(screen.getByText("Not ingested")).toBeInTheDocument();
    expect(screen.getByText("Source link")).toBeInTheDocument();
    expect(screen.getByText("Local link")).toBeInTheDocument();
    expect(screen.getByText("Suggested link")).toBeInTheDocument();
  });

  it("activates drillable single and set edges", () => {
    const onOpenSingle = vi.fn();
    const onOpenSet = vi.fn();
    render(<PreviewConnections edges={edges} onOpenSingle={onOpenSingle} onOpenSet={onOpenSet} />);
    fireEvent.click(screen.getByRole("button", { name: "Open duplicates AMP-1102" }));
    fireEvent.click(screen.getByRole("button", { name: "Open all related issues, 2 items" }));
    expect(onOpenSingle).toHaveBeenCalledWith(edges[0]);
    expect(onOpenSet).toHaveBeenCalledWith(edges[2]);
  });

  it("does not activate dangling rows by click, Enter, or Space", () => {
    const onOpenSingle = vi.fn();
    render(<PreviewConnections edges={edges} onOpenSingle={onOpenSingle} onOpenSet={vi.fn()} />);
    const row = screen.getByRole("button", { name: "blocks SEC-441, Not ingested" });
    expect(row).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(row);
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });
    expect(onOpenSingle).not.toHaveBeenCalledWith(edges[3]);
  });

  it("has no axe violations", async () => {
    const { container } = render(<PreviewConnections edges={edges} onOpenSingle={vi.fn()} onOpenSet={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("does not activate a set edge that has items but also a dangling reason", () => {
    const onOpenSet = vi.fn();
    const danglingSet: CollectionEdge<Item> = {
      id: "related:dangling-set",
      kind: "source",
      shape: "set",
      relationship: "related",
      label: "related issues",
      danglingReason: "source-not-configured",
      items: [target],
    };
    render(<PreviewConnections edges={[danglingSet]} onOpenSingle={vi.fn()} onOpenSet={onOpenSet} />);
    const row = screen.getByRole("button", { name: "related issues, Source not configured" });
    expect(row).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(row);
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });
    expect(onOpenSet).not.toHaveBeenCalled();
  });

  it("activates drillable rows with Enter and Space", () => {
    const onOpenSingle = vi.fn();
    const onOpenSet = vi.fn();
    render(<PreviewConnections edges={edges} onOpenSingle={onOpenSingle} onOpenSet={onOpenSet} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Open duplicates AMP-1102" }), { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Open all related issues, 2 items" }), { key: " " });
    expect(onOpenSingle).toHaveBeenCalledWith(edges[0]);
    expect(onOpenSet).toHaveBeenCalledWith(edges[2]);
  });
});

type ShortcutItem = { id: string };

const shortcutEdges: CollectionEdge<ShortcutItem>[] = [
  {
    id: "edge-1",
    kind: "source",
    shape: "single",
    relationship: "blocks",
    targetRef: { entityId: "jira-issue", displayKey: "AMP-1", title: "First" },
    target: { id: "1" },
  },
  {
    id: "edge-2",
    kind: "source",
    shape: "single",
    relationship: "blocks",
    targetRef: { entityId: "jira-issue", displayKey: "AMP-2", title: "Missing" },
    danglingReason: "not-ingested",
  },
  {
    id: "edge-3",
    kind: "local",
    shape: "set",
    relationship: "related",
    label: "Related issues",
    count: 2,
    items: [{ id: "1" }, { id: "2" }],
  },
];

describe("PreviewConnections quick-switcher shortcuts", () => {
  it("renders visible shortcut numbers only for supplied drillable edge ids", () => {
    render(
      <PreviewConnections
        edges={shortcutEdges}
        shortcutIndexByEdgeId={{ "edge-1": 1, "edge-3": 2 }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Shortcut 1, Open blocks AMP-1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Shortcut 2, Open Related issues, 2 items" }),
    ).toBeInTheDocument();
    // Dangling edge gets no shortcut prefix even if edge-2 were in the map
    const danglingButton = screen.getByRole("button", { name: "blocks AMP-2, Not ingested" });
    expect(danglingButton).toBeInTheDocument();
    expect(danglingButton).not.toHaveAccessibleName(/^Shortcut/);
  });

  it("does not activate dangling edges", () => {
    const onOpenSingle = vi.fn();
    render(
      <PreviewConnections
        edges={shortcutEdges}
        onOpenSingle={onOpenSingle}
        shortcutIndexByEdgeId={{ "edge-1": 1 }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "blocks AMP-2, Not ingested" }));
    expect(onOpenSingle).not.toHaveBeenCalled();
  });

  it("renders shortcut badge span with the number when shortcut is present", () => {
    const { container } = render(
      <PreviewConnections
        edges={shortcutEdges}
        shortcutIndexByEdgeId={{ "edge-1": 1 }}
      />,
    );
    // The button for edge-1 should contain a visible span showing "1"
    const button = screen.getByRole("button", { name: "Shortcut 1, Open blocks AMP-1" });
    expect(button).toHaveTextContent("1");
    // The dangling button's badge span should be aria-hidden and empty
    const danglingButton = container.querySelector('[aria-label="blocks AMP-2, Not ingested"]');
    expect(danglingButton).not.toBeNull();
    const hiddenBadge = danglingButton!.querySelector('[aria-hidden="true"]');
    expect(hiddenBadge).toBeInTheDocument();
  });
});
