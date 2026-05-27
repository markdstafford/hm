import { SlidersHorizontal } from "lucide-react";
import { IconButton } from "../../ui/buttons/IconButton";
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
};

export function CollectionHeader({
  views,
  activeViewId,
  onPick,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
}: CollectionHeaderProps) {
  return (
    <div className="flex h-8 shrink-0 items-center gap-3 border-b border-border/60 px-3">
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
      <IconButton label="View settings coming next" dimmed disabled>
        <SlidersHorizontal size={14} />
      </IconButton>
    </div>
  );
}
