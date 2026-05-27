import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Popover } from "../../../../../ui/overlays/Popover";
import type { RelativeDateValue } from "../../../filter/types";

const RELATIVE_DATE_OPTIONS = [
  { id: "today", label: "Today" },
  { id: "past-week", label: "Past week" },
  { id: "past-month", label: "Past month" },
  { id: "next-week", label: "Next week" },
] as const;

type Props = {
  value: RelativeDateValue | null;
  onChange: (value: RelativeDateValue) => void;
};

export function RelativeDatePopover({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const selectedLabel =
    RELATIVE_DATE_OPTIONS.find((opt) => opt.id === value)?.label ?? "Select period";

  function select(optionId: RelativeDateValue) {
    onChange(optionId);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      side="right"
      align="start"
      contentClassName="w-56"
      trigger={
        <button
          type="button"
          aria-label={`Relative date: ${selectedLabel}`}
          className="flex w-full items-center gap-1 rounded px-2 py-1 text-sm text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <span className="flex-1 truncate text-left">{selectedLabel}</span>
          <ChevronRight size={12} className="text-subtext" aria-hidden />
        </button>
      }
    >
      <div role="listbox" aria-label="Relative date period" className="flex flex-col gap-0.5">
        {RELATIVE_DATE_OPTIONS.map((opt) => (
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
