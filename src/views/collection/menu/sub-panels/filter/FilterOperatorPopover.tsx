import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Popover } from "../../../../../ui/overlays/Popover";
import { operatorsForKind } from "../../../filter/operators";
import type { FilterKind } from "../../../filter/types";

type Props = {
  kind: FilterKind;
  value: string;
  onChange: (operatorId: string) => void;
};

export function FilterOperatorPopover({ kind, value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const operators = operatorsForKind(kind);
  const selectedLabel = operators.find((op) => op.id === value)?.label ?? value;

  function select(operatorId: string) {
    onChange(operatorId);
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
          aria-label={`Filter operator: ${selectedLabel}`}
          className="flex items-center gap-1 rounded px-2 py-1 text-sm text-subtext hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <span className="max-w-[8rem] truncate">{selectedLabel}</span>
          <ChevronRight size={12} className="text-subtext" aria-hidden />
        </button>
      }
    >
      <div role="menu" aria-label="Filter operator" className="flex flex-col gap-0.5">
        {operators.map((op) => (
          <button
            key={op.id}
            type="button"
            role="menuitemradio"
            aria-checked={value === op.id}
            onClick={() => select(op.id)}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <span className="flex-1 text-left">{op.label}</span>
            {value === op.id && <Check size={13} aria-hidden />}
          </button>
        ))}
      </div>
    </Popover>
  );
}
