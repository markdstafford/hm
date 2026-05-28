import type { ConfirmAction } from "../ConfirmAction";
import type { UndoToastApi, UndoToastInput } from "../UndoToast";
import type { ActionCopyContext, ActionResultContext, CollectionActionDefinition } from "./types";

export type RunActionResult =
  | { status: "cancelled" }
  | { status: "applied"; batchId: string; count: number }
  | { status: "error"; error: string; batchId?: string; appliedCount: number };

export type RunCollectionActionArgs<TItem> = {
  selectedIds: ReadonlySet<string> | string[];
  items: TItem[];
  getItemId: (item: TItem) => string;
  action: CollectionActionDefinition<TItem>;
  confirm: ConfirmAction;
  toast: UndoToastApi["show"] | ((input: UndoToastInput) => void);
  clearSelection: () => void;
  sourceFeature: string;
  createBatchId?: () => string;
};

export function createCollectionBatchId(): string {
  const runtimeCrypto = globalThis.crypto;
  if (runtimeCrypto && typeof runtimeCrypto.randomUUID === "function") {
    return runtimeCrypto.randomUUID();
  }
  return `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function runCollectionAction<TItem>({
  selectedIds,
  items,
  getItemId,
  action,
  confirm,
  toast,
  clearSelection,
  sourceFeature,
  createBatchId = createCollectionBatchId,
}: RunCollectionActionArgs<TItem>): Promise<RunActionResult> {
  const selectedIdList = Array.isArray(selectedIds) ? selectedIds : [...selectedIds];
  const selectedIdSet = new Set(selectedIdList);
  const selectedItems = items.filter((item) => selectedIdSet.has(getItemId(item)));
  const currentSelectedIds = selectedItems.map(getItemId);

  if (selectedItems.length === 0) return { status: "cancelled" };
  if (action.isAvailable && !action.isAvailable(selectedItems)) return { status: "cancelled" };

  const copyContext: ActionCopyContext<TItem> = {
    actionId: action.id,
    selectedIds: currentSelectedIds,
    items: selectedItems,
    count: selectedItems.length,
    sourceFeature,
  };

  const confirmed = await confirm(action.confirm(copyContext));
  if (!confirmed) return { status: "cancelled" };

  const batchId = createBatchId();
  const beforeStates = new Map<string, unknown>();
  for (const item of selectedItems) {
    beforeStates.set(getItemId(item), action.getBeforeState(item));
  }

  const resultContext: ActionResultContext<TItem> = {
    ...copyContext,
    batchId,
    beforeStates,
  };

  let appliedCount = 0;
  try {
    for (const item of selectedItems) {
      const itemId = getItemId(item);
      await action.apply({
        ...resultContext,
        item,
        itemId,
        beforeState: beforeStates.get(itemId),
      });
      appliedCount += 1;
    }
  } catch {
    return {
      status: "error",
      error: "Action could not be completed",
      batchId,
      appliedCount,
    };
  }

  clearSelection();

  const toastInput = action.toast(resultContext);
  toast({
    ...toastInput,
    reversible: action.reversible,
    undo: action.reversible && action.reverse ? () => action.reverse?.(resultContext) : undefined,
  });

  return { status: "applied", batchId, count: selectedItems.length };
}
