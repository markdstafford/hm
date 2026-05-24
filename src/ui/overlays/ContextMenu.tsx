import * as RC from "@radix-ui/react-context-menu";
import type { ReactNode } from "react";

function Content({ children, className = "", ...rest }: RC.ContextMenuContentProps & { children: ReactNode }) {
  return (
    <RC.Portal>
      <RC.Content
        className={`z-50 min-w-[10rem] rounded border border-border bg-mantle text-text shadow-lg p-1 ${className}`}
        {...rest}
      >
        {children}
      </RC.Content>
    </RC.Portal>
  );
}

function Item({ children, className = "", ...rest }: RC.ContextMenuItemProps & { children: ReactNode }) {
  return (
    <RC.Item
      className={`flex items-center rounded px-2 py-1 text-sm text-text data-[highlighted]:bg-surface cursor-default focus:outline-none ${className}`}
      {...rest}
    >
      {children}
    </RC.Item>
  );
}

export const ContextMenu = {
  Root: RC.Root,
  Trigger: RC.Trigger,
  Content,
  Item,
  Separator: RC.Separator,
};
