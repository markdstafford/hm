import type { ReactNode } from "react";
import { ChipContextMenu } from "./ChipContextMenu";
import { ViewChips } from "./ViewChips";
import type { CollectionView } from "./views/types";

export type CollectionHeaderProps = {
  views: CollectionView[];
  activeViewId: string | null;
  onPick: (viewId: string) => void;
  onCreate: () => void;
  onRename: (viewId: string, displayName: string) => void;
  onDuplicate: (viewId: string) => void;
  onDelete: (viewId: string) => void;
  settingsSlot?: ReactNode;
};

// Rendered inside the AppShell's `mainHeader` slot. The slot provides height,
// horizontal padding, vertical centering, and the bottom border — this
// component just lays out chips on the left and the settings slot on the right.
export function CollectionHeader({
  views,
  activeViewId,
  onPick,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
  settingsSlot,
}: CollectionHeaderProps) {
  return (
    <div className="flex w-full items-center gap-3">
      <div className="min-w-0 flex-1">
        <ViewChips
          views={views}
          activeViewId={activeViewId}
          onPick={onPick}
          onCreate={onCreate}
          renderChip={(view, chip) => (
            <ChipContextMenu
              view={view}
              onRename={onRename}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            >
              {chip}
            </ChipContextMenu>
          )}
        />
      </div>
      {settingsSlot}
    </div>
  );
}
