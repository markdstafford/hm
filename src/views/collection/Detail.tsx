import { X } from "lucide-react";
import { IconButton } from "../../ui/buttons/IconButton";
import type { EntityContract } from "./types";

type Props<TItem, TProperty extends string> = {
  item: TItem;
  entity: EntityContract<TItem, TProperty>;
  onClose: () => void;
};

export function Detail<TItem, TProperty extends string>({
  item,
  entity,
  onClose,
}: Props<TItem, TProperty>) {
  const EntityDetail = entity.Detail;

  return (
    <div className="w-[440px] shrink-0 border-l border-border flex flex-col overflow-hidden">
      <div className="flex items-center justify-end px-3 py-2 shrink-0 border-b border-border">
        <IconButton label="Close issue detail" onClick={onClose}>
          <X size={12} aria-hidden />
        </IconButton>
      </div>
      <div className="flex-1 overflow-y-auto">
        <EntityDetail item={item} />
      </div>
    </div>
  );
}
