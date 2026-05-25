import * as RM from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";

function Content({ children, className = "", ...rest }: RM.DropdownMenuContentProps & { children: ReactNode }) {
  return (
    <RM.Portal>
      <RM.Content
        sideOffset={4}
        className={`z-50 min-w-[10rem] rounded border border-border bg-mantle text-text shadow-lg p-1 ${className}`}
        {...rest}
      >
        {children}
      </RM.Content>
    </RM.Portal>
  );
}

function Item({ children, className = "", ...rest }: RM.DropdownMenuItemProps & { children: ReactNode }) {
  return (
    <RM.Item
      className={`flex items-center rounded px-2 py-1 text-sm text-text data-[highlighted]:bg-surface cursor-default focus:outline-none ${className}`}
      {...rest}
    >
      {children}
    </RM.Item>
  );
}

export const DropdownMenu = {
  Root: RM.Root,
  Trigger: RM.Trigger,
  Content,
  Item,
  Separator: RM.Separator,
};
