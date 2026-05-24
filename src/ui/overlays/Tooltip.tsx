import * as RT from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

type Props = {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
};

export function Tooltip({ content, children, side = "top" }: Props) {
  return (
    <RT.Provider delayDuration={300}>
      <RT.Root>
        <RT.Trigger asChild>{children}</RT.Trigger>
        <RT.Portal>
          <RT.Content
            side={side}
            sideOffset={4}
            className="z-50 rounded border border-border bg-mantle px-2 py-1 text-xs text-text shadow"
          >
            {content}
            <RT.Arrow className="fill-mantle" />
          </RT.Content>
        </RT.Portal>
      </RT.Root>
    </RT.Provider>
  );
}
