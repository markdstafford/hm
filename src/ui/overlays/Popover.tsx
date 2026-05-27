import * as RP from "@radix-ui/react-popover";
import type { ReactNode } from "react";

type Props = {
  trigger: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  contentClassName?: string;
  onOpenAutoFocus?: RP.PopoverContentProps["onOpenAutoFocus"];
};

export function Popover({
  trigger,
  children,
  side = "bottom",
  align = "start",
  open,
  onOpenChange,
  contentClassName,
  onOpenAutoFocus,
}: Props) {
  return (
    <RP.Root open={open} onOpenChange={onOpenChange}>
      <RP.Trigger asChild>{trigger}</RP.Trigger>
      <RP.Portal>
        <RP.Content
          side={side}
          align={align}
          sideOffset={4}
          onOpenAutoFocus={onOpenAutoFocus}
          className={`z-50 rounded border border-border bg-mantle text-text shadow-lg p-2${contentClassName ? ` ${contentClassName}` : ""}`}
        >
          {children}
        </RP.Content>
      </RP.Portal>
    </RP.Root>
  );
}
