import { TextField } from "../../../../../ui/forms/TextField";
import { DatePicker } from "../../../../../ui/forms/DatePicker";
import type { FilterableProperty } from "../../../types";
import type { FilterOptionContext, FilterOperator, RelativeDateValue } from "../../../filter/types";
import type { FilterConfig } from "../../../ViewConfig";
import { FilterOptionPopover } from "./FilterOptionPopover";
import { FilterMultiSelectPopover } from "./FilterMultiSelectPopover";
import { RelativeDatePopover } from "./RelativeDatePopover";

type Props<TItem, TProperty extends string> = {
  row: FilterConfig;
  filterableProp: FilterableProperty<TItem, TProperty>;
  operator: FilterOperator;
  optionContext?: FilterOptionContext<TItem>;
  onChange: (value: unknown) => void;
};

export function FilterValueControl<TItem = unknown, TProperty extends string = string>({
  row,
  filterableProp,
  operator,
  optionContext,
  onChange,
}: Props<TItem, TProperty>) {
  const { valueControl } = operator;

  if (valueControl === "none") {
    return null;
  }

  if (valueControl === "text") {
    return (
      <TextField
        type="text"
        value={typeof row.value === "string" ? row.value : ""}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Filter value"
      />
    );
  }

  if (valueControl === "number") {
    return (
      <TextField
        type="number"
        value={row.value === "" || row.value == null ? "" : String(row.value)}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw);
        }}
        aria-label="Filter value"
      />
    );
  }

  if (valueControl === "date") {
    return (
      <DatePicker
        value={typeof row.value === "string" ? row.value : null}
        onChange={onChange}
        aria-label="Filter value"
      />
    );
  }

  if (valueControl === "relative-date") {
    const relValue =
      row.value === "today" ||
      row.value === "past-week" ||
      row.value === "past-month" ||
      row.value === "next-week"
        ? (row.value as RelativeDateValue)
        : null;
    return (
      <RelativeDatePopover
        value={relValue}
        onChange={(v) => onChange(v)}
      />
    );
  }

  const options = filterableProp.options?.(optionContext ?? { items: [] }) ?? [];

  if (valueControl === "single-select") {
    return (
      <FilterOptionPopover
        options={options}
        value={typeof row.value === "string" ? row.value : null}
        onChange={onChange}
        label="Filter value"
      />
    );
  }

  if (valueControl === "multi-select") {
    return (
      <FilterMultiSelectPopover
        options={options}
        value={Array.isArray(row.value) ? (row.value as string[]) : []}
        onChange={onChange}
        label="Filter value"
      />
    );
  }

  if (valueControl === "person") {
    return (
      <FilterOptionPopover
        options={options}
        value={typeof row.value === "string" ? row.value : null}
        onChange={onChange}
        label="Filter value"
      />
    );
  }

  return null;
}
