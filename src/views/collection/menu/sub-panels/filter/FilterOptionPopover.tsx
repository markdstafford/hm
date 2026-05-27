import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Popover } from "../../../../../ui/overlays/Popover";
import type { FilterOption } from "../../../filter/types";

type Props = {
  options: FilterOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  label: string;
};

export function FilterOptionPopover({ options, value, onChange, label }: Props) {
  const [open, setOpen] = useState(false);

  const selectedLabel = options.find((opt) => opt.id === value)?.label ?? "Any";

  function select(optionId: string) {
    if (value === optionId) {
      onChange(null);
    } else {
      onChange(optionId);
    }
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
          aria-label={`${label}: ${selectedLabel}`}
          className="flex w-full items-center gap-1 rounded px-2 py-1 text-sm text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <span className="flex-1 truncate text-left">{selectedLabel}</span>
          <ChevronRight size={12} className="text-subtext" aria-hidden />
        </button>
      }
    >
      <div role="listbox" aria-label={label} className="flex flex-col gap-0.5">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="option"
            aria-selected={value === opt.id}
            onClick={() => select(opt.id)}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <span className="flex-1 text-left">{opt.label}</span>
            {value === opt.id && <Check size={13} aria-hidden />}
          </button>
        ))}
      </div>
    </Popover>
  );
}
