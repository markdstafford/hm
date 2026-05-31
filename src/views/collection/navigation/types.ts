export type CollectionEdgeKind = "source" | "local" | "suggested";
export type CollectionEdgeShape = "single" | "set";

export type CollectionEdgeDanglingReason =
  | "not-ingested"
  | "source-not-configured"
  | "unsupported-target"
  | "unresolved";

export type CollectionItemRef = {
  entityId: string;
  sourceId?: string | null;
  sourceKind?: string;
  upstreamId?: string;
  localId?: string;
  displayKey: string;
  title?: string | null;
};

export type CollectionEdgeBase = {
  id: string;
  kind: CollectionEdgeKind;
  relationship: string;
  danglingReason?: CollectionEdgeDanglingReason;
  confidence?: number;
};

export type SingleTargetEdge<TItem> = CollectionEdgeBase & {
  shape: "single";
  targetRef: CollectionItemRef;
  target?: TItem;
};

export type SetTargetEdge<TItem> = CollectionEdgeBase & {
  shape: "set";
  label: string;
  count?: number;
  items?: TItem[];
};

export type CollectionEdge<TItem> = SingleTargetEdge<TItem> | SetTargetEdge<TItem>;

export type ResolveCollectionEdgesArgs<TItem> = {
  item: TItem;
  allItems: TItem[];
};

export type FocusTrailEntry<TItem> = {
  item: TItem;
  label: string;
};

export type CollectionRootSnapshot<TItem> = {
  id: string;
  label: string;
  items: TItem[];
  selectedId: string | null;
  previewOpen: boolean;
};

export type ActiveCollectionRoot<TItem> = CollectionRootSnapshot<TItem> & {
  base: boolean;
  parentLabel?: string;
};
