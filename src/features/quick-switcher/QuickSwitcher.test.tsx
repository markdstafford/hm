import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import type { EntityContract, EntityDetailProps } from "../../views/collection/types";
import type { CollectionEdge } from "../../views/collection/navigation/types";
import type { QuickSwitcherSource } from "./types";
import { QuickSwitcher } from "./QuickSwitcher";

type Item = { id: string; key: string; title: string; project: string; status: string; edges?: CollectionEdge<Item>[] };

type Prop = string;

const items: Item[] = [
  { id: "a", key: "AMP-1087", title: "Cardinality mismatch", project: "AMP", status: "Open" },
  { id: "b", key: "AMP-1014", title: "Create LSP shim", project: "AMP", status: "Backlog" },
];

function Detail({ item, preview, edges, onOpenSingleEdge }: EntityDetailProps<Item>) {
  return (
    <div data-testid="entity-detail" data-surface={preview?.surface} data-size={preview?.sizeClass}>
      <h2>{item.key}</h2>
      <p>{item.title}</p>
      {edges?.map((edge) => edge.shape === "single" ? (
        <button key={edge.id} type="button" onClick={() => onOpenSingleEdge?.(edge)}>
          Open {edge.targetRef.displayKey}
        </button>
      ) : null)}
    </div>
  );
}

const entity: EntityContract<Item, Prop> = {
  id: "test-entity",
  label: "Test items",
  getId: (item) => item.id,
  properties: [],
  defaultProperties: [],
  defaultSort: (a, b) => a.key.localeCompare(b.key),
  resolveEdges: ({ item }) => item.edges ?? [],
  Detail,
  defaultViews: [],
};

function makeSource(openItem = vi.fn().mockReturnValue(true)): QuickSwitcherSource {
  const source: QuickSwitcherSource<Item> = {
    id: "test-source",
    entity,
    items,
    toQuickSwitcherItem: (item) => ({
      id: item.id,
      sourceId: "test-source",
      entityId: "test-entity",
      kindLabel: "Jira",
      primaryLabel: item.key,
      title: item.title,
      contextLabel: `${item.project} · ${item.status}`,
      item,
      searchableText: [item.key, item.title, item.project, item.status],
      rankBoosts: { exact: [item.key], prefix: [item.key] },
    }),
    openItem,
  };
  return source as unknown as QuickSwitcherSource;
}

describe("QuickSwitcher", () => {
  it("renders a centered dialog with focused search input and disabled browser assistance", async () => {
    render(<QuickSwitcher open onOpenChange={vi.fn()} sources={[makeSource()]} />);
    const input = screen.getByRole("combobox", { name: "Search items" });
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveAttribute("placeholder", "Search items…");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("autocorrect", "off");
    expect(input).toHaveAttribute("autocapitalize", "none");
    expect(input).toHaveAttribute("spellcheck", "false");
  });

  it("renders ranked rows and a canonical compact preview for the active result", async () => {
    render(<QuickSwitcher open onOpenChange={vi.fn()} sources={[makeSource()]} />);
    await userEvent.type(screen.getByRole("combobox", { name: "Search items" }), "1087");
    expect(screen.getByRole("option", { name: /Jira AMP-1087 Cardinality mismatch AMP · Open/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("entity-detail")).toHaveAttribute("data-surface", "quick-switcher");
    expect(screen.getByTestId("entity-detail")).toHaveAttribute("data-size", "compact");
  });

  it("shows no-match copy without collapsing the palette", async () => {
    render(<QuickSwitcher open onOpenChange={vi.fn()} sources={[makeSource()]} />);
    await userEvent.type(screen.getByRole("combobox", { name: "Search items" }), "missing");
    expect(screen.getByText('No local items match "missing"')).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Preview" })).toBeInTheDocument();
  });

  it("moves focus to results on ArrowDown, clamps, and returns to input from the top", async () => {
    render(<QuickSwitcher open onOpenChange={vi.fn()} sources={[makeSource()]} />);
    const input = screen.getByRole("combobox", { name: "Search items" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("listbox", { name: "Quick switcher results" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Quick switcher results" }), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Quick switcher results" }), { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: /AMP-1014/i })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Quick switcher results" }), { key: "ArrowUp" });
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Quick switcher results" }), { key: "ArrowUp" });
    expect(input).toHaveFocus();
  });

  it("opens the active result with Enter and closes after successful open", async () => {
    const openItem = vi.fn().mockReturnValue(true);
    const onOpenChange = vi.fn();
    render(<QuickSwitcher open onOpenChange={onOpenChange} sources={[makeSource(openItem)]} />);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Search items" }), { key: "Enter" });
    expect(openItem).toHaveBeenCalledWith(items[0], { openPreview: true, scopedFallback: true });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps digits in the input until result navigation begins", async () => {
    const user = userEvent.setup();
    render(<QuickSwitcher open onOpenChange={vi.fn()} sources={[makeSource()]} />);
    const input = screen.getByRole("combobox", { name: "Search items" });
    await user.type(input, "1");
    expect(input).toHaveValue("1");
  });

  it("has no axe violations for populated and no-results states", async () => {
    const { container, rerender } = render(<QuickSwitcher open onOpenChange={vi.fn()} sources={[makeSource()]} />);
    expect(await axe(container)).toHaveNoViolations();
    rerender(<QuickSwitcher open onOpenChange={vi.fn()} sources={[makeSource()]} initialQuery="missing" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("opens numbered drillable connections only from results focus", () => {
    const target: Item = { id: "b", key: "AMP-1014", title: "Create LSP shim", project: "AMP", status: "Backlog" };
    const edge: CollectionEdge<Item> = {
      id: "edge-b",
      kind: "source",
      shape: "single",
      relationship: "blocks",
      targetRef: { entityId: "test-entity", displayKey: "AMP-1014", title: "Create LSP shim" },
      target,
    };
    const openSingleEdge = vi.fn().mockReturnValue(true);
    const source = makeSource();
    source.items = [{ ...items[0], edges: [edge] }, target];
    source.openSingleEdge = openSingleEdge;
    const onOpenChange = vi.fn();

    render(<QuickSwitcher open onOpenChange={onOpenChange} sources={[source]} />);

    fireEvent.keyDown(screen.getByRole("combobox", { name: "Search items" }), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Quick switcher results" }), { key: "1" });

    expect(openSingleEdge).toHaveBeenCalledWith(edge);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not number or activate dangling connections", () => {
    const edge: CollectionEdge<Item> = {
      id: "missing",
      kind: "source",
      shape: "single",
      relationship: "blocks",
      targetRef: { entityId: "jira-issue", displayKey: "AMP-404", title: "Missing" },
      danglingReason: "not-ingested",
    };
    const source = makeSource();
    source.items = [{ ...items[0], edges: [edge] }];
    source.openSingleEdge = vi.fn().mockReturnValue(true);

    render(<QuickSwitcher open onOpenChange={vi.fn()} sources={[source]} />);

    fireEvent.keyDown(screen.getByRole("combobox", { name: "Search items" }), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Quick switcher results" }), { key: "1" });

    expect(source.openSingleEdge).not.toHaveBeenCalled();
  });
});
