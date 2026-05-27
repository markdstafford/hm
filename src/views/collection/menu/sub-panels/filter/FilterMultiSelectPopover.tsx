import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Popover } from "../../../../../ui/overlays/Popover";
import type { FilterOption } from "../../../filter/types";

type Props = {
  options: FilterOption[];
  value: string[];
  onChange: (value: string[]) => void;
  label: string;
};

export function FilterMultiSelectPopover({ options, value, onChange, label }: Props) {
  const [open, setOpen] = useState(false);

  const selectedLabels = value
    .map((id) => options.find((opt) => opt.id === id)?.label ?? id)
    .join(", ");
  const triggerLabel = selectedLabels || "Any";

  function toggle(optionId: string) {
    if (value.includes(optionId)) {
      onChange(value.filter((id) => id !== optionId));
    } else {
      onChange([...value, optionId]);
    }
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
          aria-label={`${label}: ${triggerLabel}`}
          className="flex w-full items-center gap-1 rounded px-2 py-1 text-sm text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <span className="flex-1 truncate text-left">{triggerLabel}</span>
          <ChevronRight size={12} className="text-subtext" aria-hidden />
        </button>
      }
    >
      <div role="menu" aria-label={label} className="flex flex-col gap-0.5">
        {options.map((opt) => {
          const isSelected = value.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              role="menuitemcheckbox"
              aria-checked={isSelected}
              onClick={() => toggle(opt.id)}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <span className="flex-1 text-left">{opt.label}</span>
              {isSelected && <Check size={13} aria-hidden />}
            </button>
          );
        })}
      </div>
    </Popover>
  );
}
