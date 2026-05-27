import type { ReactNode } from "react";

export type FilterKind =
  | "text"
  | "number"
  | "select"
  | "multi-select"
  | "date"
  | "person"
  | "checkbox";

export type FilterValueControl =
  | "none"
  | "text"
  | "number"
  | "single-select"
  | "multi-select"
  | "date"
  | "relative-date"
  | "person";

export type RelativeDateValue = "today" | "past-week" | "past-month" | "next-week";

export type FilterOption = {
  id: string;
  label: string;
  color?: string;
  icon?: ReactNode;
};

export type FilterOptionContext<TItem = unknown> = {
  items: TItem[];
  optionsByProperty?: Partial<Record<string, FilterOption[]>>;
};

export type FilterOperator = {
  id: string;
  label: string;
  valueControl: FilterValueControl;
  requiresValue: boolean;
};
