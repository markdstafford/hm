import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Popover } from "../../../ui/overlays/Popover";
import { IconButton } from "../../../ui/buttons/IconButton";
import { normalizeViewConfig, summarizeViewConfig } from "../ViewConfig";
import type { ViewConfig } from "../ViewConfig";
import type { EntityContract } from "../types";
import type { CollectionView } from "../views/types";
import { TopSheet } from "./TopSheet";
import { LayoutPanel } from "./sub-panels/LayoutPanel";
import { PropertyVisibilityPanel } from "./sub-panels/PropertyVisibilityPanel";
import { SortPanel } from "./sub-panels/SortPanel";
import { GroupPanel } from "./sub-panels/GroupPanel";
import { FilterPanel } from "./sub-panels/FilterPanel";
import type { ViewSettingsPanel } from "./types";

export type { ViewSettingsPanel };

export type ViewSettingsMenuProps<TItem = unknown, TProperty extends string = string> = {
  activeView: CollectionView | null;
  entity: EntityContract<TItem, TProperty>;
  onRenameView: (viewId: string, displayName: string) => void | Promise<void>;
  onPatchConfig: (viewId: string, config: ViewConfig) => void | Promise<void>;
  onOpenChange?: (open: boolean) => void;
};

export function ViewSettingsMenu<TItem = unknown, TProperty extends string = string>({
  activeView,
  entity,
  onRenameView,
  onPatchConfig,
  onOpenChange,
}: ViewSettingsMenuProps<TItem, TProperty>) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<ViewSettingsPanel>("top");
  const [draftName, setDraftName] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);

  function handleOpenChange(newOpen: boolean) {
    onOpenChange?.(newOpen);
    if (newOpen) {
      setPanel("top");
      setRenameError(null);
      setDraftName(activeView?.displayName ?? "");
      setOpen(true);
    } else {
      setOpen(false);
      setPanel("top");
    }
  }

  // Close when activeView changes
  useEffect(() => {
    if (open) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView?.id]);

  const normalizedConfig = useMemo(
    () => normalizeViewConfig(activeView?.config, entity),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeView?.config, entity],
  );

  const summary = useMemo(
    () => summarizeViewConfig(normalizedConfig, entity),
    [normalizedConfig, entity],
  );

  async function handlePatchConfig(config: ViewConfig) {
    if (!activeView) return;
    await onPatchConfig(activeView.id, config);
  }

  async function commitRename() {
    const trimmed = draftName.trim();
    if (!trimmed) {
      setRenameError("View name cannot be blank");
      return;
    }
    setRenameError(null);
    if (!activeView) return;
    if (trimmed === activeView.displayName) return;
    try {
      await onRenameView(activeView.id, trimmed);
    } catch {
      setDraftName(activeView.displayName);
      setRenameError("Could not save view name");
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      side="bottom"
      align="end"
      contentClassName="w-80 p-0"
      trigger={
        <IconButton label="Open view settings" disabled={!activeView}>
          <SlidersHorizontal size={14} />
        </IconButton>
      }
    >
      <section aria-label="View settings">
        {panel === "top" && (
          <TopSheet
            viewName={activeView?.displayName ?? ""}
            draftName={draftName}
            renameError={renameError}
            onDraftNameChange={setDraftName}
            onCommitRename={commitRename}
            onNavigate={setPanel}
            onClose={() => handleOpenChange(false)}
            summary={summary}
          />
        )}
        {panel === "layout" && (
          <LayoutPanel config={normalizedConfig} onPatchConfig={handlePatchConfig} onBack={() => setPanel("top")} onClose={() => handleOpenChange(false)} />
        )}
        {panel === "property-visibility" && (
          <PropertyVisibilityPanel
            entity={entity}
            config={normalizedConfig}
            onPatchConfig={handlePatchConfig}
            onBack={() => setPanel("top")}
            onClose={() => handleOpenChange(false)}
          />
        )}
        {panel === "sort" && (
          <SortPanel
            entity={entity}
            config={normalizedConfig}
            onPatchConfig={handlePatchConfig}
            onBack={() => setPanel("top")}
            onClose={() => handleOpenChange(false)}
          />
        )}
        {panel === "group" && (
          <GroupPanel onBack={() => setPanel("top")} onClose={() => handleOpenChange(false)} />
        )}
        {panel === "filter" && (
          <FilterPanel onBack={() => setPanel("top")} onClose={() => handleOpenChange(false)} />
        )}
      </section>
    </Popover>
  );
}
