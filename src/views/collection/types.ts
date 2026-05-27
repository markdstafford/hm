import type { ReactNode, ComponentType } from "react";

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

export type EntityContract<TItem, TProperty extends string> = {
  id: string;
  label: string;
  getId: (item: TItem) => string;
  properties: PropertyDefinition<TItem, TProperty>[];
  defaultProperties: PropertyConfig<TProperty>[];
  defaultSort: (a: TItem, b: TItem) => number;
  Detail: ComponentType<{ item: TItem }>;
};
