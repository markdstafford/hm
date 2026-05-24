import * as RD from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

function Content({ children, className = "", ...rest }: RD.DialogContentProps & { children: ReactNode }) {
  return (
    <RD.Portal>
      <RD.Overlay className="fixed inset-0 bg-crust/60 z-40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <RD.Content
        className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 min-w-[20rem] max-w-[90vw] rounded border border-border bg-mantle p-6 text-text shadow-lg focus:outline-none ${className}`}
        {...rest}
      >
        {children}
      </RD.Content>
    </RD.Portal>
  );
}

function Title({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <RD.Title className={`text-lg font-semibold ${className}`}>{children}</RD.Title>;
}

function Description({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <RD.Description className={`text-sm text-subtext mt-1 ${className}`}>{children}</RD.Description>;
}

export const Dialog = {
  Root: RD.Root,
  Trigger: RD.Trigger,
  Close: RD.Close,
  Content,
  Title,
  Description,
};
