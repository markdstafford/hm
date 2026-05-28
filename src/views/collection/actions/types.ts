import type { ConfirmActionInput } from "../ConfirmAction";
import type { UndoToastInput } from "../UndoToast";

export type CollectionActionSlot = "primary" | "conditionalPrimary" | "destructive";
export type CollectionActionKind = "primary" | "destructive";

export type ActionCopyContext<TItem> = {
  actionId: string;
  selectedIds: string[];
  items: TItem[];
  count: number;
  sourceFeature: string;
};

export type ActionResultContext<TItem> = ActionCopyContext<TItem> & {
  batchId: string;
  beforeStates: Map<string, unknown>;
};

export type ApplyActionContext<TItem> = ActionResultContext<TItem> & {
  item: TItem;
  itemId: string;
  beforeState: unknown;
};

export type ReverseActionContext<TItem> = ActionResultContext<TItem>;

export type CollectionActionDefinition<TItem> = {
  id: string;
  label: string | ((count: number) => string);
  slot: CollectionActionSlot;
  kind: CollectionActionKind;
  isAvailable?: (items: TItem[]) => boolean;
  confirm: (context: ActionCopyContext<TItem>) => ConfirmActionInput;
  toast: (context: ActionResultContext<TItem>) => UndoToastInput;
  reversible: boolean;
  getBeforeState: (item: TItem) => unknown;
  apply: (context: ApplyActionContext<TItem>) => Promise<void>;
  reverse?: (context: ReverseActionContext<TItem>) => Promise<void>;
};
