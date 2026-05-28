import { X } from "lucide-react";
import { IconButton } from "../../../../../ui/buttons/IconButton";
import type { EntityContract } from "../../../types";
import type { FilterOptionContext } from "../../../filter/types";
import type { FilterConfig } from "../../../ViewConfig";
import { filterablePropertyFor } from "../../../filter/config";
import { defaultOperatorForKind, operatorFor } from "../../../filter/operators";
import { FilterPropertyPopover } from "./FilterPropertyPopover";
import { FilterOperatorPopover } from "./FilterOperatorPopover";
import { FilterValueControl } from "./FilterValueControl";

type Props<TItem, TProperty extends string> = {
  row: FilterConfig;
  entity: EntityContract<TItem, TProperty>;
  optionContext?: FilterOptionContext<TItem>;
  onUpdateProperty: (propertyId: string) => void;
  onUpdateOperator: (operatorId: string) => void;
  onUpdateValue: (value: unknown) => void;
  onRemove: () => void;
};

export function FilterRow<TItem = unknown, TProperty extends string = string>({
  row,
  entity,
  optionContext,
  onUpdateProperty,
  onUpdateOperator,
  onUpdateValue,
  onRemove,
}: Props<TItem, TProperty>) {
  const filterableProp = filterablePropertyFor(entity, row.property);

  if (!filterableProp) {
    return null;
  }

  const propLabel =
    entity.properties.find((p) => String(p.id) === row.property)?.label ?? row.property;

  const op =
    operatorFor(filterableProp.kind, row.operator) ??
    defaultOperatorForKind(filterableProp.kind);

  return (
    <li
      data-testid={`filter-row-${row.id}`}
      className="flex items-center gap-1 rounded px-1 py-1 text-sm hover:bg-surface"
    >
      <FilterPropertyPopover
        entity={entity}
        value={row.property}
        onChange={onUpdateProperty}
      />
      <FilterOperatorPopover
        kind={filterableProp.kind}
        value={op.id}
        onChange={onUpdateOperator}
      />
      <div className="min-w-0 flex-1">
        <FilterValueControl
          row={row}
          filterableProp={filterableProp}
          operator={op}
          optionContext={optionContext}
          onChange={onUpdateValue}
        />
      </div>
      <IconButton label={`Remove ${propLabel} filter`} onClick={onRemove}>
        <X size={13} aria-hidden />
      </IconButton>
    </li>
  );
}
