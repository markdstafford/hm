import type { ReactNode, ComponentType } from "react";
import type { CollectionView } from "./views/types";
import type {
  FilterKind,
  FilterOption,
  FilterOptionContext,
} from "./filter/types";
import type { PreviewSurface } from "./ViewConfig";
import type { PreviewSizeClass } from "./previewSizing";
import type {
  CollectionEdge,
  ResolveCollectionEdgesArgs,
  SingleTargetEdge,
  SetTargetEdge,
} from "./navigation/types";

export type PropertySide = "left" | "right";
export type PropertyKind = "text" | "number" | "date" | "categorical" | "tags";

export type CellRenderer<TItem, TProperty extends string> = (props: {
  item: TItem;
  property: TProperty;
}) => ReactNode;

export type PropertyDefinition<TItem, TProperty extends string> = {
  id: TProperty;
  label: string;
  kind: PropertyKind;
  icon?: ReactNode;
  renderCell: CellRenderer<TItem, TProperty>;
  isStretch?: boolean;
};

export type PropertyConfig<TProperty extends string> = {
  property: TProperty;
  side: PropertySide;
  visible: boolean;
};

export type PreviewFieldTier = 1 | 2 | 3;

export type PreviewFieldConfig<TProperty extends string> = {
  property: TProperty;
  tier: PreviewFieldTier;
  pinned?: boolean;
};

export type PreviewFieldDefinition<TItem, TProperty extends string> = {
  property: TProperty;
  label?: string;
  renderCell?: CellRenderer<TItem, TProperty>;
  isEmpty?: (item: TItem) => boolean;
  pinEligible?: boolean;
};

export type PreviewFieldSourceConfig<TProperty extends string> = {
  sourceId: string | null;
  entityId: string;
  fields: PreviewFieldConfig<TProperty>[];
};

export type PreviewFieldsConfig<TProperty extends string> = {
  version: 1;
  sources: PreviewFieldSourceConfig<TProperty>[];
};

export type ResolvedPreviewField<TItem, TProperty extends string> = {
  definition: PreviewFieldDefinition<TItem, TProperty>;
  config: PreviewFieldConfig<TProperty>;
  effectiveTier: PreviewFieldTier;
  pinned: boolean;
};

export type PropertyComparator<TItem> = (a: TItem, b: TItem) => number;

export type SortableProperty<TItem, TProperty extends string> = {
  property: TProperty;
  compare: PropertyComparator<TItem>;
  isNull?: (item: TItem) => boolean;
  defaultDirection?: "asc" | "desc";
};

export type BucketKey = string;

export type BucketContext = {
  now?: Date;
  locale?: string;
  timeZone?: string;
};

export type BucketDefinition = {
  key: BucketKey;
  label: string;
  emptyLabel?: string;
};

export type GroupableProperty<TItem, TProperty extends string> = {
  property: TProperty;
  bucketKeyFor: (item: TItem, context?: BucketContext) => BucketKey;
  bucketLabelFor?: (key: BucketKey) => string;
  bucketOrder: (items?: TItem[], context?: BucketContext) => BucketDefinition[];
};

export type FilterableProperty<TItem, TProperty extends string> = {
  property: TProperty;
  kind: FilterKind;
  getValue: (item: TItem) => unknown;
  options?: (context: FilterOptionContext<TItem>) => FilterOption[];
};

export type EntityPreviewSurface = PreviewSurface | "quick-switcher";

export type EntityPreviewMetadata = {
  surface: EntityPreviewSurface;
  width: number | null;
  height: number | null;
  sizeClass: PreviewSizeClass;
};

export type EntityDetailProps<TItem> = {
  item: TItem;
  preview?: EntityPreviewMetadata;
  edges?: CollectionEdge<TItem>[];
  onOpenSingleEdge?: (edge: SingleTargetEdge<TItem>) => void;
  onOpenSetEdge?: (edge: SetTargetEdge<TItem>) => void;
};

export type EntityContract<TItem, TProperty extends string> = {
  id: string;
  label: string;
  /** Singular noun used in accessible labels (e.g. "issue", "suggestion"). Defaults to entity id. */
  detailLabel?: string;
  getId: (item: TItem) => string;
  getRowLabel?: (item: TItem) => string;
  /** Returns a short readable label for breadcrumbs and focus-trail entries. Falls back to renderCell("key") then getId. */
  getFocusLabel?: (item: TItem) => string;
  properties: PropertyDefinition<TItem, TProperty>[];
  defaultProperties: PropertyConfig<TProperty>[];
  previewFields?: PreviewFieldDefinition<TItem, TProperty>[];
  defaultPreviewFields?: PreviewFieldConfig<TProperty>[];
  resolvePreviewFieldConfig?: (item: TItem) => PreviewFieldConfig<TProperty>[];
  defaultSort: (a: TItem, b: TItem) => number;
  sortableProperties?: SortableProperty<TItem, TProperty>[];
  groupableProperties?: GroupableProperty<TItem, TProperty>[];
  filterableProperties?: FilterableProperty<TItem, TProperty>[];
  resolveEdges?: (args: ResolveCollectionEdgesArgs<TItem>) => CollectionEdge<TItem>[];
  Detail: ComponentType<EntityDetailProps<TItem>>;
  defaultViews: CollectionView[];
};
