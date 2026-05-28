import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Button } from "../../ui/buttons/Button";
import { Toast } from "../../ui/feedback/Toast";

export type UndoToastInput = {
  message: string;
  description?: string;
  undo?: () => void | Promise<void>;
  reversible: boolean;
};

export type UndoToastApi = {
  show: (input: UndoToastInput) => void;
  dismiss: () => void;
};

const UndoToastContext = createContext<UndoToastApi | null>(null);

export function UndoToastProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState<UndoToastInput | null>(null);

  const dismiss = useCallback(() => {
    setOpen(false);
    setInput(null);
  }, []);

  const show = useCallback((next: UndoToastInput) => {
    setOpen(false);
    setInput(next);
    window.setTimeout(() => setOpen(true), 0);
  }, []);

  // Self-managed 8-second auto-dismiss so fake timers work in tests
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => dismiss(), 8000);
    return () => window.clearTimeout(id);
  }, [open, dismiss]);

  const api: UndoToastApi = { show, dismiss };
  const canUndo = input?.reversible === true && !!input.undo;

  async function handleUndo() {
    if (!input?.undo) return;
    await input.undo();
    dismiss();
  }

  return (
    <UndoToastContext.Provider value={api}>
      <Toast.Provider>
        {children}
        {input && (
          <Toast.Root open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : dismiss())}>
            <Toast.Title>{input.message}</Toast.Title>
            {input.description && <Toast.Description>{input.description}</Toast.Description>}
            {canUndo && (
              <Toast.Action asChild altText="Undo">
                <Button size="sm" variant="ghost" onClick={handleUndo}>
                  Undo
                </Button>
              </Toast.Action>
            )}
          </Toast.Root>
        )}
        <Toast.Viewport />
      </Toast.Provider>
    </UndoToastContext.Provider>
  );
}

export function useUndoToast(): UndoToastApi {
  const api = useContext(UndoToastContext);
  if (!api) throw new Error("useUndoToast must be used within UndoToastProvider");
  return api;
}
