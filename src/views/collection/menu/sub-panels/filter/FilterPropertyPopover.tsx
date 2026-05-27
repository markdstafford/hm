import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Popover } from "../../../../../ui/overlays/Popover";
import type { EntityContract } from "../../../types";

type Props<TItem, TProperty extends string> = {
  entity: EntityContract<TItem, TProperty>;
  value: string;
  onChange: (propertyId: string) => void;
};

export function FilterPropertyPopover<TItem = unknown, TProperty extends string = string>({
  entity,
  value,
  onChange,
}: Props<TItem, TProperty>) {
  const [open, setOpen] = useState(false);

  const filterableProperties = entity.filterableProperties ?? [];
  const selectedLabel =
    entity.properties.find((p) => String(p.id) === value)?.label ?? value;

  function select(propertyId: string) {
    onChange(propertyId);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      side="right"
      align="start"
      contentClassName="w-72"
      trigger={
        <button
          type="button"
          aria-label={`Filter property: ${selectedLabel}`}
          className="flex items-center gap-1 rounded px-2 py-1 text-sm text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <span className="max-w-[6rem] truncate">{selectedLabel}</span>
          <ChevronRight size={12} className="text-subtext" aria-hidden />
        </button>
      }
    >
      <div role="listbox" aria-label="Filter property" className="flex flex-col gap-0.5">
        {filterableProperties.map((fp) => {
          const id = String(fp.property);
          const label = entity.properties.find((p) => String(p.id) === id)?.label ?? id;
          return (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={value === id}
              onClick={() => select(id)}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <span className="flex-1 text-left">{label}</span>
              {value === id && <Check size={13} aria-hidden />}
            </button>
          );
        })}
      </div>
    </Popover>
  );
}
