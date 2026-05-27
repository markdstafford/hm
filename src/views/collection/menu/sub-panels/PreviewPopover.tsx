import { useState, type ReactNode } from "react";
import { Check, PanelRight, PanelBottom, Maximize2 } from "lucide-react";
import { Popover } from "../../../../ui/overlays/Popover";
import type { PreviewSurface } from "../../ViewConfig";

export type PreviewOption = {
  value: PreviewSurface;
  label: string;
  description: string;
  icon: ReactNode;
};

export const PREVIEW_OPTIONS: PreviewOption[] = [
  {
    value: "side-peek",
    label: "Side",
    description: "Detail opens in a 440px right rail.",
    icon: <PanelRight size={14} aria-hidden />,
  },
  {
    value: "bottom-peek",
    label: "Bottom",
    description: "Detail opens in a 280px bottom pane.",
    icon: <PanelBottom size={14} aria-hidden />,
  },
  {
    value: "full-page",
    label: "Full page",
    description: "Detail takes the whole content area.",
    icon: <Maximize2 size={14} aria-hidden />,
  },
];

export function previewLabel(preview: PreviewSurface): string {
  return PREVIEW_OPTIONS.find((o) => o.value === preview)?.label ?? "Side";
}

type PreviewPopoverProps = {
  current: PreviewSurface;
  trigger: ReactNode;
  onSelect: (preview: PreviewSurface) => void | Promise<void>;
};

export function PreviewPopover({ current, trigger, onSelect }: PreviewPopoverProps) {
  const [open, setOpen] = useState(false);

  async function selectPreview(preview: PreviewSurface) {
    await onSelect(preview);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      side="right"
      align="start"
      contentClassName="w-80 p-1"
      trigger={trigger}
    >
      <div role="listbox" aria-label="Preview options" className="flex flex-col gap-1">
        {PREVIEW_OPTIONS.map((option) => {
          const selected = option.value === current;
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => void selectPreview(option.value)}
              className="flex w-full items-start gap-2 rounded px-2 py-2 text-left text-sm hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <span className="mt-0.5 shrink-0 text-subtext">{option.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-text">{option.label}</span>
                <span className="block text-xs text-subtext">{option.description}</span>
              </span>
              <span className="w-4 shrink-0 text-primary" aria-hidden>
                {selected ? <Check size={14} /> : null}
              </span>
              {selected && <span className="sr-only">Selected</span>}
            </button>
          );
        })}
      </div>
    </Popover>
  );
}
