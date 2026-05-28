import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Button } from "../../ui/buttons/Button";
import { AlertDialog } from "../../ui/overlays/AlertDialog";

export type ConfirmActionInput = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  kind?: "primary" | "destructive";
};

export type ConfirmAction = (input: ConfirmActionInput) => Promise<boolean>;

const ConfirmActionContext = createContext<ConfirmAction | null>(null);

type PendingConfirm = {
  input: ConfirmActionInput;
  resolve: (confirmed: boolean) => void;
};

export function ConfirmActionProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const settledRef = useRef(false);

  const settle = useCallback((confirmed: boolean) => {
    setPending((current) => {
      if (!current || settledRef.current) return current;
      settledRef.current = true;
      current.resolve(confirmed);
      return null;
    });
  }, []);

  const confirm = useCallback<ConfirmAction>((input) => {
    return new Promise<boolean>((resolve) => {
      settledRef.current = false;
      setPending({ input, resolve });
    });
  }, []);

  const input = pending?.input;
  const kind = input?.kind ?? "primary";

  return (
    <ConfirmActionContext.Provider value={confirm}>
      {children}
      <AlertDialog.Root
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) settle(false);
        }}
      >
        {input && (
          <AlertDialog.Content>
            <AlertDialog.Title>{input.title}</AlertDialog.Title>
            <AlertDialog.Description>{input.description}</AlertDialog.Description>
            <div className="mt-4 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button variant="ghost" onClick={() => settle(false)}>
                  {input.cancelLabel ?? "Cancel"}
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button variant={kind === "destructive" ? "destructive" : "primary"} onClick={() => settle(true)}>
                  {input.confirmLabel}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        )}
      </AlertDialog.Root>
    </ConfirmActionContext.Provider>
  );
}

export function useConfirmAction(): ConfirmAction {
  const confirm = useContext(ConfirmActionContext);
  if (!confirm) throw new Error("useConfirmAction must be used within ConfirmActionProvider");
  return confirm;
}
