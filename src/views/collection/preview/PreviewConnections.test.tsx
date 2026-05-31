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
