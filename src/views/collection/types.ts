import type { ReactNode, ComponentType } from "react";
import type { CollectionView } from "./views/types";
import type {
  FilterKind,
  FilterOption,
  FilterOptionContext,
} from "./filter/types";

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

export type EntityContract<TItem, TProperty extends string> = {
  id: string;
  label: string;
  getId: (item: TItem) => string;
  getRowLabel?: (item: TItem) => string;
  properties: PropertyDefinition<TItem, TProperty>[];
  defaultProperties: PropertyConfig<TProperty>[];
  defaultSort: (a: TItem, b: TItem) => number;
  sortableProperties?: SortableProperty<TItem, TProperty>[];
  groupableProperties?: GroupableProperty<TItem, TProperty>[];
  filterableProperties?: FilterableProperty<TItem, TProperty>[];
  Detail: ComponentType<{ item: TItem }>;
  defaultViews: CollectionView[];
};
