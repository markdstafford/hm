import { runCollectionAction } from "./runner";
import type { CollectionActionDefinition } from "./types";

type Item = { id: string; title: string; status: string };

function makeAction(overrides: Partial<CollectionActionDefinition<Item>> = {}) {
  const apply = vi.fn<CollectionActionDefinition<Item>["apply"]>(async () => {});
  const reverse = vi.fn<NonNullable<CollectionActionDefinition<Item>["reverse"]>>(async () => {});
  const action: CollectionActionDefinition<Item> = {
    id: "approve",
    label: (count) => `Approve ${count}`,
    slot: "primary",
    kind: "primary",
    confirm: ({ count }) => ({
      title: `Approve ${count} items?`,
      description: "Applies fake changes and records them locally.",
      confirmLabel: "Approve",
      kind: "primary",
    }),
    toast: ({ count }) => ({
      message: `Approved ${count} items`,
      description: "Logged locally.",
      reversible: true,
    }),
    reversible: true,
    getBeforeState: (item) => ({ status: item.status }),
    apply,
    reverse,
    ...overrides,
  };
  return { action, apply, reverse };
}

const items: Item[] = [
  { id: "a", title: "Alpha", status: "open" },
  { id: "b", title: "Beta", status: "open" },
];

describe("runCollectionAction", () => {
  it("returns cancelled without confirmation when no current selected items remain", async () => {
    const { action, apply } = makeAction();
    const confirm = vi.fn(async () => true);

    const result = await runCollectionAction({
      selectedIds: new Set(["stale"]),
      items,
      getItemId: (item) => item.id,
      action,
      confirm,
      toast: vi.fn(),
      clearSelection: vi.fn(),
      sourceFeature: "test-runner",
      createBatchId: () => "batch-1",
    });

    expect(result).toEqual({ status: "cancelled" });
    expect(confirm).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });

  it("does not apply or clear when confirmation is cancelled", async () => {
    const { action, apply } = makeAction();
    const clearSelection = vi.fn();

    const result = await runCollectionAction({
      selectedIds: new Set(["a", "b"]),
      items,
      getItemId: (item) => item.id,
      action,
      confirm: vi.fn(async () => false),
      toast: vi.fn(),
      clearSelection,
      sourceFeature: "test-runner",
      createBatchId: () => "batch-1",
    });

    expect(result).toEqual({ status: "cancelled" });
    expect(apply).not.toHaveBeenCalled();
    expect(clearSelection).not.toHaveBeenCalled();
  });

  it("applies every current selected item with one shared batch id", async () => {
    const { action, apply } = makeAction();
    const toast = vi.fn();
    const clearSelection = vi.fn();

    const result = await runCollectionAction({
      selectedIds: new Set(["a", "b", "stale"]),
      items,
      getItemId: (item) => item.id,
      action,
      confirm: vi.fn(async () => true),
      toast,
      clearSelection,
      sourceFeature: "test-runner",
      createBatchId: () => "batch-1",
    });

    expect(result).toEqual({ status: "applied", batchId: "batch-1", count: 2 });
    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply.mock.calls.map(([context]) => context.itemId)).toEqual(["a", "b"]);
    expect(apply.mock.calls.map(([context]) => context.batchId)).toEqual(["batch-1", "batch-1"]);
    expect(apply.mock.calls[0][0].beforeState).toEqual({ status: "open" });
    expect(clearSelection).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ message: "Approved 2 items", reversible: true }));
  });

  it("wires toast undo to the reverse handler when reversible", async () => {
    const { action, reverse } = makeAction();
    let undo: (() => void | Promise<void>) | undefined;

    await runCollectionAction({
      selectedIds: new Set(["a"]),
      items,
      getItemId: (item) => item.id,
      action,
      confirm: vi.fn(async () => true),
      toast: vi.fn((input) => {
        undo = input.undo;
      }),
      clearSelection: vi.fn(),
      sourceFeature: "test-runner",
      createBatchId: () => "batch-1",
    });

    expect(undo).toBeTypeOf("function");
    await undo?.();

    expect(reverse).toHaveBeenCalledTimes(1);
    expect(reverse.mock.calls[0][0]).toMatchObject({
      actionId: "approve",
      batchId: "batch-1",
      selectedIds: ["a"],
      count: 1,
      sourceFeature: "test-runner",
    });
  });

  it("does not attach undo when action is non-reversible", async () => {
    const { action } = makeAction({ reversible: false, reverse: undefined });
    const toast = vi.fn();

    await runCollectionAction({
      selectedIds: new Set(["a"]),
      items,
      getItemId: (item) => item.id,
      action,
      confirm: vi.fn(async () => true),
      toast,
      clearSelection: vi.fn(),
      sourceFeature: "test-runner",
      createBatchId: () => "batch-1",
    });

    expect(toast.mock.calls[0][0].undo).toBeUndefined();
  });

  it("stops on first apply failure and returns a safe error without showing success toast", async () => {
    const apply = vi.fn<CollectionActionDefinition<Item>["apply"]>(async ({ itemId }) => {
      if (itemId === "b") throw new Error("raw secret token abc123 and stack trace");
    });
    const { action } = makeAction({ apply });
    const toast = vi.fn();
    const clearSelection = vi.fn();

    const result = await runCollectionAction({
      selectedIds: new Set(["a", "b"]),
      items,
      getItemId: (item) => item.id,
      action,
      confirm: vi.fn(async () => true),
      toast,
      clearSelection,
      sourceFeature: "test-runner",
      createBatchId: () => "batch-1",
    });

    expect(result).toEqual({
      status: "error",
      error: "Action could not be completed",
      batchId: "batch-1",
      appliedCount: 1,
    });
    expect(toast).not.toHaveBeenCalled();
    expect(clearSelection).not.toHaveBeenCalled();
  });
});
