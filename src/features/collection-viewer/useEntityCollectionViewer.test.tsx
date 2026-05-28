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
});
