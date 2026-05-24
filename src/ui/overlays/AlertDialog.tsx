import * as RA from "@radix-ui/react-alert-dialog";
import type { ReactNode } from "react";

function Content({ children, className = "", ...rest }: RA.AlertDialogContentProps & { children: ReactNode }) {
  return (
    <RA.Portal>
      <RA.Overlay className="fixed inset-0 bg-crust/60 z-40" />
      <RA.Content
        className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 min-w-[20rem] max-w-[90vw] rounded border border-border bg-mantle p-6 text-text shadow-lg focus:outline-none ${className}`}
        {...rest}
      >
        {children}
      </RA.Content>
    </RA.Portal>
  );
}

export const AlertDialog = {
  Root: RA.Root,
  Trigger: RA.Trigger,
  Content,
  Title: RA.Title,
  Description: RA.Description,
  Cancel: RA.Cancel,
  Action: RA.Action,
};
