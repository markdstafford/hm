import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Popover } from "../../../../ui/overlays/Popover";
import type { EntityContract, GroupableProperty } from "../../types";

type Props<TItem = unknown, TProperty extends string = string> = {
  groupableProperties: GroupableProperty<TItem, TProperty>[];
  entity: EntityContract<TItem, TProperty>;
  value: string | null;
  onSelect: (propertyId: string | null) => void;
};

function propertyLabel<TItem, TProperty extends string>(
  entity: EntityContract<TItem, TProperty>,
  propertyId: string,
): string {
  return entity.properties.find((p) => String(p.id) === propertyId)?.label ?? "Unknown property";
}

function propertyIcon<TItem, TProperty extends string>(
  entity: EntityContract<TItem, TProperty>,
  propertyId: string,
) {
  return entity.properties.find((p) => String(p.id) === propertyId)?.icon ?? null;
}

export function GroupByPopover<TItem = unknown, TProperty extends string = string>({
  groupableProperties,
  entity,
  value,
  onSelect,
}: Props<TItem, TProperty>) {
  const [open, setOpen] = useState(false);
  const summary = value === null ? "None" : propertyLabel(entity, value);

  function select(propertyId: string | null) {
    onSelect(propertyId);
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
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          aria-label={`Group by ${summary}`}
          disabled={groupableProperties.length === 0}
        >
          <span className="flex-1 text-left text-text">Group by</span>
          <span className="text-xs text-subtext">{summary}</span>
          <ChevronRight size={12} className="text-subtext" aria-hidden />
        </button>
      }
    >
      <div role="listbox" aria-label="Group by property" className="flex flex-col gap-0.5">
        <button
          type="button"
          role="option"
          aria-selected={value === null}
          onClick={() => select(null)}
          className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <span className="w-4 text-center text-subtext" aria-hidden>—</span>
          <span className="flex-1 text-left">None</span>
          {value === null && <Check size={13} aria-hidden />}
        </button>
        {groupableProperties.map((groupable) => {
          const id = String(groupable.property);
          const label = propertyLabel(entity, id);
          const icon = propertyIcon(entity, id);
          return (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={value === id}
              onClick={() => select(id)}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <span className="flex w-4 items-center justify-center text-subtext">{icon}</span>
              <span className="flex-1 text-left">{label}</span>
              {value === id && <Check size={13} aria-hidden />}
            </button>
          );
        })}
      </div>
    </Popover>
  );
}
