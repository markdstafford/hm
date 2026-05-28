import { X } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "../../ui/buttons/IconButton";

export type BulkActionBarProps = {
  count: number;
  slots: {
    primary?: ReactNode;
    conditionalPrimary?: ReactNode;
    destructive?: ReactNode;
    [slot: string]: ReactNode | undefined;
  };
  onClear: () => void;
};

const CANONICAL_SLOT_ORDER = ["primary", "conditionalPrimary", "destructive"];

export function BulkActionBar({ count, slots, onClear }: BulkActionBarProps) {
  if (count <= 0) return null;

  const extraSlotNames = Object.keys(slots).filter(
    (slotName) => !CANONICAL_SLOT_ORDER.includes(slotName),
  );
  const orderedSlotNames = [...CANONICAL_SLOT_ORDER, ...extraSlotNames];

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="fixed bottom-[calc(var(--height-footer)+0.75rem)] left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded border border-border bg-mantle px-3 py-2 text-text shadow-lg"
    >
      <span className="whitespace-nowrap text-sm font-medium tabular-nums">
        {count} selected
      </span>
      <div className="flex items-center gap-2">
        {orderedSlotNames.map((slotName) => {
          const node = slots[slotName];
          if (!node) return null;
          return <span key={slotName}>{node}</span>;
        })}
      </div>
      <IconButton label="Clear selection" onClick={onClear}>
        <X size={14} aria-hidden />
      </IconButton>
    </div>
  );
}
