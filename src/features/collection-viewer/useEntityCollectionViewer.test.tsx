import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityContract } from "../../views/collection/types";
import { useEntityCollectionViewer } from "./useEntityCollectionViewer";

type Item = { id: string; key: string; title: string; score: number };
type Prop = "key" | "title" | "score";

const entity: EntityContract<Item, Prop> = {
  id: "test-entity",
  label: "Test items",
  getId: (item) => item.id,
  getRowLabel: (item) => `Open test ${item.key}`,
  properties: [
    { id: "key", label: "Key", kind: "text", renderCell: ({ item }) => item.key },
    { id: "title", label: "Title", kind: "text", isStretch: true, renderCell: ({ item }) => item.title },
    { id: "score", label: "Score", kind: "number", renderCell: ({ item }) => `${item.score}` },
  ],
  defaultProperties: [
    { property: "key", side: "left", visible: true },
    { property: "title", side: "left", visible: true },
    { property: "score", side: "right", visible: true },
  ],
  defaultSort: (a, b) => a.key.localeCompare(b.key),
  sortableProperties: [{ property: "score", compare: (a, b) => a.score - b.score, defaultDirection: "desc" }],
  Detail: ({ item }) => <h2>{item.title}</h2>,
  defaultViews: [{ id: "test-all", entityKind: "test-entity", displayName: "All", position: 0, isDefault: true, config: {} }],
};

vi.mock("../../bindings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../bindings")>();
  return { ...actual, commands: { ...actual.commands, collectionViewsSeedDefaults: vi.fn(), collectionViewSave: vi.fn(), collectionViewDelete: vi.fn() } };
});
vi.mock("../../preferences/storage", () => ({ loadPreferences: vi.fn(), savePreferences: vi.fn() }));

import { commands } from "../../bindings";
import { loadPreferences, savePreferences } from "../../preferences/storage";

const drillEntity: EntityContract<Item, Prop> = {
  ...entity,
  filterableProperties: [{ property: "key" as Prop, kind: "text" as const, getValue: (item) => item.key }],
  resolveEdges: ({ item, allItems }) => {
    if (item.id !== "item-a") return [];
    const target = allItems.find((candidate) => candidate.id === "item-b");
    const setItems = allItems.filter((candidate) => candidate.id === "item-b" || candidate.id === "item-c");
    return [
      {
        id: "duplicates:item-b",
        kind: "source",
        shape: "single",
        relationship: "duplicates",
        targetRef: { entityId: "test-entity", displayKey: "B-1", title: "Beta" },
        target,
        danglingReason: target ? undefined : ("not-ingested" as const),
      },
      {
        id: "related:set",
        kind: "local",
        shape: "set",
        relationship: "all related",
        label: "Related to A-1",
        count: setItems.length,
        items: setItems,
      },
    ] as import("../../views/collection/navigation/types").CollectionEdge<Item>[];
  },
  Detail: ({ item, edges, onOpenSingleEdge, onOpenSetEdge }) => (
    <div>
      <h2>{item.title}</h2>
      {edges?.map((edge) => {
        if (edge.shape === "single") {
          return (
            <button key={edge.id} type="button" onClick={() => onOpenSingleEdge?.(edge)}>
              Open {edge.targetRef.displayKey}
            </button>
          );
        }
        return (
          <button key={edge.id} type="button" onClick={() => onOpenSetEdge?.(edge)}>
            Open {edge.label}
          </button>
        );
      })}
    </div>
  ),
};

function DrillHarness({ items }: { items: Item[] }) {
  const viewer = useEntityCollectionViewer({
    active: true,
    entity: drillEntity,
    items,
    loading: false,
    error: null,
    copy: {
      loadingLabel: "Loading test items",
      emptyTitle: "No test items",
      emptyDescription: "No test items loaded.",
      errorTitle: "Could not load test items",
    },
  });
  return <div>{viewer.header}{viewer.body}</div>;
}

// Entity where nested set-edges can re-root twice (A→[B,C], B→[C,D])
const nestedDrillEntity: EntityContract<Item, Prop> = {
  ...entity,
  resolveEdges: ({ item, allItems }) => {
    if (item.id === "item-a") {
      const setItems = allItems.filter((i) => i.id === "item-b" || i.id === "item-c");
      return [{
        id: "set:from-a",
        kind: "local" as const,
        shape: "set" as const,
        relationship: "related",
        label: "Related to A-1",
        count: setItems.length,
        items: setItems,
      }];
    }
    if (item.id === "item-b") {
      const setItems = allItems.filter((i) => i.id === "item-c" || i.id === "item-d");
      return [{
        id: "set:from-b",
        kind: "local" as const,
        shape: "set" as const,
        relationship: "related",
        label: "Related to B-1",
        count: setItems.length,
        items: setItems,
      }];
    }
    return [];
  },
  Detail: ({ item, edges, onOpenSetEdge }) => (
    <div>
      <h2>{item.title}</h2>
      {edges?.map((edge) => {
        if (edge.shape === "set") {
          return (
            <button key={edge.id} type="button" onClick={() => onOpenSetEdge?.(edge)}>
              Open {edge.label}
            </button>
          );
        }
        return null;
      })}
    </div>
  ),
};

function NestedDrillHarness({ items }: { items: Item[] }) {
  const viewer = useEntityCollectionViewer({
    active: true,
    entity: nestedDrillEntity,
    items,
    loading: false,
    error: null,
    copy: {
      loadingLabel: "Loading",
      emptyTitle: "No items",
      emptyDescription: "",
      errorTitle: "Error",
    },
  });
  return <div>{viewer.header}{viewer.body}</div>;
}

// Entity where getId returns an opaque id but getFocusLabel returns the readable key,
// and the key property renderCell returns a React element (not a string)
const opaqueIdEntity: EntityContract<Item, Prop> = {
  ...entity,
  getId: (item) => `opaque:${item.id}`,
  getFocusLabel: (item) => item.key,
  getRowLabel: (item) => `Open test ${item.key}`,
  properties: [
    { id: "key", label: "Key", kind: "text", renderCell: ({ item }) => <span className="mono">{item.key}</span> },
    { id: "title", label: "Title", kind: "text", isStretch: true, renderCell: ({ item }) => item.title },
    { id: "score", label: "Score", kind: "number", renderCell: ({ item }) => `${item.score}` },
  ],
  resolveEdges: ({ item, allItems }) => {
    if (item.id !== "item-a") return [];
    const target = allItems.find((i) => i.id === "item-b");
    return [{
      id: "dup:item-b",
      kind: "source" as const,
      shape: "single" as const,
      relationship: "duplicates",
      targetRef: { entityId: "test-entity", displayKey: "B-1", title: "Beta" },
      target,
      danglingReason: target ? undefined : ("not-ingested" as const),
    }];
  },
  Detail: ({ item, edges, onOpenSingleEdge }) => (
    <div>
      <h2>{item.title}</h2>
      {edges?.map((edge) => {
        if (edge.shape === "single") {
          return (
            <button key={edge.id} type="button" onClick={() => onOpenSingleEdge?.(edge)}>
              Open {edge.targetRef.displayKey}
            </button>
          );
        }
        return null;
      })}
    </div>
  ),
};

function OpaqueIdHarness({ items }: { items: Item[] }) {
  const viewer = useEntityCollectionViewer({
    active: true,
    entity: opaqueIdEntity,
    items,
    loading: false,
    error: null,
    copy: {
      loadingLabel: "Loading",
      emptyTitle: "No items",
      emptyDescription: "",
      errorTitle: "Error",
    },
  });
  return <div>{viewer.header}{viewer.body}</div>;
}

function Harness({ items = [{ id: "item-a", key: "A-1", title: "Alpha", score: 2 }] }: { items?: Item[] }) {
  const viewer = useEntityCollectionViewer({
    active: true,
    entity,
    items,
    loading: false,
    error: null,
    copy: {
      loadingLabel: "Loading test items",
      emptyTitle: "No test items",
      emptyDescription: "No test items loaded.",
      errorTitle: "Could not load test items",
    },
  });
  return <div>{viewer.header}{viewer.body}</div>;
}

describe("useEntityCollectionViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).__TAURI_INTERNALS__ = { invoke: vi.fn() };
    vi.mocked(commands.collectionViewsSeedDefaults).mockResolvedValue({ status: "ok", data: [{ id: "test-all", entity_kind: "test-entity", display_name: "All", position: 0, is_default: true, config: {} }] });
    vi.mocked(commands.collectionViewSave).mockImplementation(async (view: any) => ({ status: "ok", data: { id: view.id, entity_kind: view.entity_kind, display_name: view.display_name, position: view.position, is_default: view.is_default, config: view.config } }));
    vi.mocked(loadPreferences).mockResolvedValue({ collections: { activeViewId: { "test-entity": "test-all" } } });
    vi.mocked(savePreferences).mockResolvedValue({ ok: true, next: { collections: { activeViewId: { "test-entity": "test-all" } } } });
  });

  it("uses entity.getId for selection and row keys", async () => {
    render(<Harness />);
    fireEvent.click(await screen.findByRole("button", { name: "Open test A-1" }));
    expect(screen.getByRole("button", { name: "Open test A-1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Alpha" })).toBeInTheDocument();
  });

  it("seeds views and active preferences by entity id", async () => {
    render(<Harness />);
    expect(await screen.findByRole("button", { name: "All" })).toHaveAttribute("aria-current", "true");
    await waitFor(() => expect(commands.collectionViewsSeedDefaults).toHaveBeenCalledWith(expect.objectContaining({ entity_kind: "test-entity" })));
    expect(loadPreferences).toHaveBeenCalled();
  });

  it("stores active view preferences under the active entity id", async () => {
    vi.mocked(loadPreferences).mockResolvedValue({});
    render(<Harness />);
    await screen.findByRole("button", { name: "All" });
    await waitFor(() =>
      expect(savePreferences).toHaveBeenCalledWith(expect.any(Object), {
        collections: { activeViewId: { "test-entity": "test-all" } },
      }),
    );
  });

  it("focus-drills into a single-target edge without changing list selection", async () => {
    render(<DrillHarness items={[
      { id: "item-a", key: "A-1", title: "Alpha", score: 2 },
      { id: "item-b", key: "B-1", title: "Beta", score: 1 },
    ]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Open test A-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Open B-1" }));
    expect(screen.getByRole("heading", { name: "Beta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open test A-1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("navigation", { name: "Preview focus path" })).toHaveTextContent("A-1");
    expect(screen.getByRole("navigation", { name: "Preview focus path" })).toHaveTextContent("B-1");
  });

  it("truncates the focus trail when an earlier crumb is clicked", async () => {
    render(<DrillHarness items={[
      { id: "item-a", key: "A-1", title: "Alpha", score: 2 },
      { id: "item-b", key: "B-1", title: "Beta", score: 1 },
    ]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Open test A-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Open B-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Return to A-1" }));
    expect(screen.getByRole("heading", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Preview focus path" })).not.toBeInTheDocument();
  });

  it("resets the focus trail when a different row is selected", async () => {
    render(<DrillHarness items={[
      { id: "item-a", key: "A-1", title: "Alpha", score: 2 },
      { id: "item-b", key: "B-1", title: "Beta", score: 1 },
    ]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Open test A-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Open B-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Open test B-1" }));
    expect(screen.getByRole("heading", { name: "Beta" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Preview focus path" })).not.toBeInTheDocument();
  });

  it("re-roots the list to a set edge before applying active sort", async () => {
    render(<DrillHarness items={[
      { id: "item-a", key: "A-1", title: "Alpha", score: 2 },
      { id: "item-b", key: "B-1", title: "Beta", score: 1 },
      { id: "item-c", key: "C-1", title: "Gamma", score: 9 },
    ]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Open test A-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Related to A-1" }));
    expect(screen.getByRole("status")).toHaveTextContent("Related to A-1");
    expect(screen.queryByRole("button", { name: "Open test A-1" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open test B-1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open test C-1" })).toBeInTheDocument();
  });

  it("returns from a re-rooted set and restores prior selection", async () => {
    render(<DrillHarness items={[
      { id: "item-a", key: "A-1", title: "Alpha", score: 2 },
      { id: "item-b", key: "B-1", title: "Beta", score: 1 },
      { id: "item-c", key: "C-1", title: "Gamma", score: 9 },
    ]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Open test A-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Related to A-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to All" }));
    expect(screen.getByRole("button", { name: "Open test A-1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Alpha" })).toBeInTheDocument();
  });

  it("keyboard movement uses the active re-rooted display list", async () => {
    render(<DrillHarness items={[
      { id: "item-a", key: "A-1", title: "Alpha", score: 2 },
      { id: "item-b", key: "B-1", title: "Beta", score: 1 },
      { id: "item-c", key: "C-1", title: "Gamma", score: 9 },
    ]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Open test A-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Related to A-1" }));
    fireEvent.keyDown(document, { key: "j" });
    expect(screen.queryByRole("button", { name: "Open test A-1" })).not.toBeInTheDocument();
    const pressedRows = screen
      .getAllByRole("button", { name: /Open test [BC]-1/ })
      .filter((el) => el.getAttribute("aria-pressed") === "true");
    expect(pressedRows).toHaveLength(1);
  });

  it("coerces preview to first visible item when set-edge first item is filtered out (INIT-1)", async () => {
    // Override the seeded view to include a filter that excludes B-1
    vi.mocked(commands.collectionViewsSeedDefaults).mockResolvedValueOnce({
      status: "ok" as const,
      data: [{
        id: "test-all",
        entity_kind: "test-entity",
        display_name: "All",
        position: 0,
        is_default: true,
        config: {
          filters: [{ id: "f1", property: "key", operator: "is-not", value: "B-1", active: true }],
        },
      }],
    });

    render(<DrillHarness items={[
      { id: "item-a", key: "A-1", title: "Alpha", score: 2 },
      { id: "item-b", key: "B-1", title: "Beta", score: 1 },
      { id: "item-c", key: "C-1", title: "Gamma", score: 9 },
    ]} />);

    fireEvent.click(await screen.findByRole("button", { name: "Open test A-1" }));
    // Set contains [B-1, C-1]. B-1 is filtered out by the active view filter.
    fireEvent.click(screen.getByRole("button", { name: "Open Related to A-1" }));
    // The preview must show Gamma (C-1, first visible item), not Beta (B-1, filtered out)
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Beta" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Gamma" })).toBeInTheDocument();
  });

  it("returns from nested re-roots all the way to All without losing the base snapshot (INIT-2)", async () => {
    render(<NestedDrillHarness items={[
      { id: "item-a", key: "A-1", title: "Alpha", score: 2 },
      { id: "item-b", key: "B-1", title: "Beta", score: 1 },
      { id: "item-c", key: "C-1", title: "Gamma", score: 9 },
      { id: "item-d", key: "D-1", title: "Delta", score: 5 },
    ]} />);

    // Open scope1: Related to A-1 = [B, C]
    fireEvent.click(await screen.findByRole("button", { name: "Open test A-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Related to A-1" }));
    expect(screen.getByRole("status")).toHaveTextContent("Related to A-1");

    // Open scope2 from B-1: Related to B-1 = [C, D]
    fireEvent.click(screen.getByRole("button", { name: "Open Related to B-1" }));
    expect(screen.getByRole("status")).toHaveTextContent("Related to B-1");

    // First Back → scope1
    fireEvent.click(screen.getByRole("button", { name: "Back to All" }));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Related to A-1");
    });

    // Second Back → All (no re-root banner)
    fireEvent.click(screen.getByRole("button", { name: "Back to All" }));
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Open test A-1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open test B-1" })).toBeInTheDocument();
  });

  it("uses entity getFocusLabel rather than falling back to getId for breadcrumb labels (INIT-3)", async () => {
    render(<OpaqueIdHarness items={[
      { id: "item-a", key: "A-1", title: "Alpha", score: 2 },
      { id: "item-b", key: "B-1", title: "Beta", score: 1 },
    ]} />);

    fireEvent.click(await screen.findByRole("button", { name: "Open test A-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Open B-1" }));

    const breadcrumb = screen.getByRole("navigation", { name: "Preview focus path" });
    expect(breadcrumb).toHaveTextContent("A-1");
    expect(breadcrumb).toHaveTextContent("B-1");
    // Must not fall back to the opaque getId value
    expect(breadcrumb).not.toHaveTextContent("opaque:item-a");
    expect(breadcrumb).not.toHaveTextContent("opaque:item-b");
  });
});
