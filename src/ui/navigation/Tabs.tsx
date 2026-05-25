import * as RT from "@radix-ui/react-tabs";
import type { ReactNode } from "react";

function List({ children, className = "", ...rest }: RT.TabsListProps & { children: ReactNode }) {
  return <RT.List className={`flex gap-1 border-b border-border ${className}`} {...rest}>{children}</RT.List>;
}

function Trigger({ children, className = "", ...rest }: RT.TabsTriggerProps & { children: ReactNode }) {
  return (
    <RT.Trigger
      className={`h-control-base px-3 text-sm text-subtext hover:text-text data-[state=active]:text-text data-[state=active]:border-b-2 data-[state=active]:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${className}`}
      {...rest}
    >
      {children}
    </RT.Trigger>
  );
}

function Content({ children, className = "", ...rest }: RT.TabsContentProps & { children: ReactNode }) {
  return <RT.Content className={`pt-3 ${className}`} {...rest}>{children}</RT.Content>;
}

export const Tabs = { Root: RT.Root, List, Trigger, Content };
