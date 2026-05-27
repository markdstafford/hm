import { useState, type ReactNode } from "react";
import { Button } from "../../ui/buttons/Button";
import { Dialog } from "../../ui/overlays/Dialog";
import { AlertDialog } from "../../ui/overlays/AlertDialog";
import { ContextMenu } from "../../ui/overlays/ContextMenu";
import type { CollectionView } from "./views/types";

export type ChipContextMenuProps = {
  view: CollectionView;
  children: ReactNode;
  onRename: (viewId: string, displayName: string) => void;
  onDuplicate: (viewId: string) => void;
  onDelete: (viewId: string) => void;
};

export function ChipContextMenu({
  view,
  children,
  onRename,
  onDuplicate,
  onDelete,
}: ChipContextMenuProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(view.displayName);
  const [error, setError] = useState<string | null>(null);

  function commitRename() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a view name.");
      return;
    }
    setError(null);
    onRename(view.id, trimmed);
    setRenameOpen(false);
  }

  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
        <ContextMenu.Content>
          <ContextMenu.Item
            onSelect={() => {
              setName(view.displayName);
              setError(null);
              setRenameOpen(true);
            }}
          >
            Rename
          </ContextMenu.Item>
          <ContextMenu.Item onSelect={() => onDuplicate(view.id)}>Duplicate</ContextMenu.Item>
          <ContextMenu.Item className="text-red" onSelect={() => setDeleteOpen(true)}>
            Delete
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Root>

      <Dialog.Root open={renameOpen} onOpenChange={setRenameOpen}>
        <Dialog.Content>
          <Dialog.Title>Rename view</Dialog.Title>
          <Dialog.Description>Choose a short display name for this collection view.</Dialog.Description>
          <label className="mt-4 flex flex-col gap-1 text-sm text-text">
            <span>View name</span>
            <input
              aria-label="View name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitRename();
              }}
              className="h-control-base rounded border border-border bg-background px-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
          </label>
          {error && <p className="mt-2 text-sm text-red">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={commitRename}>Save</Button>
          </div>
        </Dialog.Content>
      </Dialog.Root>

      <AlertDialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialog.Content>
          <AlertDialog.Title className="text-lg font-semibold">Delete {view.displayName}?</AlertDialog.Title>
          <AlertDialog.Description className="mt-1 text-sm text-subtext">
            This removes the named view chip. Jira issues and source data are not deleted.
          </AlertDialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="destructive" onClick={() => onDelete(view.id)}>Delete view</Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  );
}
