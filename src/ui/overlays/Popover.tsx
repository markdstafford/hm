import * as RP from "@radix-ui/react-popover";
import type { ReactNode } from "react";

type Props = {
  trigger: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
};

export function Popover({ trigger, children, side = "bottom", align = "start" }: Props) {
  return (
    <RP.Root>
      <RP.Trigger asChild>{trigger}</RP.Trigger>
      <RP.Portal>
        <RP.Content
          side={side}
          align={align}
          sideOffset={4}
          className="z-50 rounded border border-border bg-mantle text-text shadow-lg"
        >
          {children}
        </RP.Content>
      </RP.Portal>
    </RP.Root>
  );
}
