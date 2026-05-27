import { Switch } from "../../../../ui/forms/Switch";
import {
  availableGroupProperties,
  patchViewConfig,
  removeGrouping,
  setGroupProperty,
  setHideEmptyGroups,
  type ViewConfig,
} from "../../ViewConfig";
import type { EntityContract } from "../../types";
import { PanelHeader } from "../PanelHeader";
import { GroupByPopover } from "./GroupByPopover";

type Props<TItem = unknown, TProperty extends string = string> = {
  entity: EntityContract<TItem, TProperty>;
  config: ViewConfig;
  onPatchConfig: (config: ViewConfig) => void | Promise<void>;
  onBack: () => void;
  onClose: () => void;
};

export function GroupPanel<TItem = unknown, TProperty extends string = string>({
  entity,
  config,
  onPatchConfig,
  onBack,
  onClose,
}: Props<TItem, TProperty>) {
  const groupableProperties = availableGroupProperties(entity);
  const hasGrouping = config.group.property !== null;

  function patchGroup(nextGroup: ViewConfig["group"]) {
    void onPatchConfig(patchViewConfig(config, { group: nextGroup }));
  }

  return (
    <>
      <PanelHeader title="Group" onBack={onBack} onClose={onClose} />
      <div className="flex min-h-44 flex-col px-3 py-3">
        {groupableProperties.length === 0 ? (
          <p className="text-sm text-subtext">No groupable properties available for this collection.</p>
        ) : (
          <GroupByPopover
            groupableProperties={groupableProperties}
            entity={entity}
            value={config.group.property}
            onSelect={(property) => patchGroup(setGroupProperty(config.group, property))}
          />
        )}

        <div className="mt-1 flex items-center justify-between rounded px-2 py-1.5">
          <span className="text-sm text-text">Hide empty groups</span>
          <Switch
            label="Hide empty groups"
            hideLabelText
            checked={config.group.hideEmptyGroups}
            onCheckedChange={(checked) => patchGroup(setHideEmptyGroups(config.group, checked))}
          />
        </div>

        <div className="mt-auto flex justify-end pt-4">
          {hasGrouping && (
            <button
              type="button"
              onClick={() => patchGroup(removeGrouping(config.group))}
              className="rounded px-2 py-1 text-sm text-subtext hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Remove grouping
            </button>
          )}
        </div>
      </div>
    </>
  );
}
