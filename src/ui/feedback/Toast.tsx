import * as RT from "@radix-ui/react-toast";
import type { ReactNode } from "react";

function Root({ children, className = "", ...rest }: RT.ToastProps & { children: ReactNode }) {
  return (
    <RT.Root
      className={`rounded border border-border bg-mantle text-text shadow-lg p-3 ${className}`}
      {...rest}
    >
      {children}
    </RT.Root>
  );
}

function Viewport({ className = "", ...rest }: RT.ToastViewportProps) {
  return (
    <RT.Viewport
      className={`fixed bottom-4 right-4 z-50 flex flex-col gap-2 outline-none ${className}`}
      {...rest}
    />
  );
}

export const Toast = {
  Provider: RT.Provider,
  Root,
  Viewport,
  Title: RT.Title,
  Description: RT.Description,
  Action: RT.Action,
  Close: RT.Close,
};
