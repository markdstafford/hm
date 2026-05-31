import type { ReactNode } from "react";
import type { EntityContract } from "../../views/collection/types";
import type { CollectionEdge, SingleTargetEdge, SetTargetEdge } from "../../views/collection/navigation/types";

export type QuickSwitcherOpenOptions<TItem = unknown> = {
  openPreview?: boolean;
  scopedFallback?: boolean;
  edge?: CollectionEdge<TItem>;
};

export type QuickSwitcherItem<TItem = unknown> = {
  id: string;
  sourceId: string;
  entityId: string;
  kindLabel: string;
  primaryLabel: string;
  title: string;
  contextLabel?: string;
  statusLabel?: string;
  item: TItem;
  searchableText: string[];
  rankBoosts?: {
    exact?: string[];
    prefix?: string[];
  };
};

export type QuickSwitcherSource<TItem = unknown> = {
  id: string;
  entity: EntityContract<TItem, string>;
  items: TItem[];
  loading?: boolean;
  error?: string | null;
  toQuickSwitcherItem: (item: TItem) => QuickSwitcherItem<TItem>;
  openItem: (item: TItem, options?: QuickSwitcherOpenOptions<TItem>) => boolean;
  openSingleEdge?: (edge: SingleTargetEdge<TItem>) => boolean;
  openSetEdge?: (edge: SetTargetEdge<TItem>) => boolean;
  previewUnavailable?: ReactNode;
};

export type QuickSwitcherMatchKind =
  | "default"
  | "exact"
  | "prefix"
  | "title-word-prefix"
  | "title-substring"
  | "context-substring";

export type QuickSwitcherResult<TItem = unknown> = {
  id: string;
  source: QuickSwitcherSource<TItem>;
  item: QuickSwitcherItem<TItem>;
  sourceIndex: number;
  itemIndex: number;
  score: number;
  match: {
    kind: QuickSwitcherMatchKind;
    field: string | null;
  };
};

export type QuickSwitcherNumberedEdge<TItem = unknown> = {
  number: number;
  edge: CollectionEdge<TItem>;
};
