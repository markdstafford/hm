import { ArrowUp, ArrowDown, X } from "lucide-react";
import { IconButton } from "../../ui/buttons/IconButton";
import type { EntityContract } from "./types";
import type { PreviewSurface } from "./ViewConfig";

type DetailSurface = Extract<PreviewSurface, "side-peek" | "bottom-peek">;

type Props<TItem, TProperty extends string> = {
  item: TItem;
  entity: EntityContract<TItem, TProperty>;
  surface: DetailSurface;
  index: number;
  total: number;
  canMovePrevious: boolean;
  canMoveNext: boolean;
  onClose: () => void;
  onMovePrevious: () => void;
  onMoveNext: () => void;
};

export function Detail<TItem, TProperty extends string>({
  item, entity, surface, index, total, canMovePrevious, canMoveNext, onClose, onMovePrevious, onMoveNext,
}: Props<TItem, TProperty>) {
  const EntityDetail = entity.Detail;
  const frameClass = surface === "side-peek"
    ? "w-[440px] shrink-0 border-l border-border"
    : "h-[280px] shrink-0 border-t border-border";
  const noun = entity.detailLabel ?? entity.id;
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);

  return (
    <aside aria-label={`${Noun} detail`} className={`${frameClass} flex flex-col overflow-hidden bg-background`}>
      <div className="flex items-center gap-2 px-3 py-2 shrink-0 border-b border-border">
        <span className="mr-auto text-xs tabular-nums text-subtext">{index + 1} of {total}</span>
        <button
          type="button"
          aria-label={`Previous ${noun}`}
          disabled={!canMovePrevious}
          onClick={onMovePrevious}
          className="inline-flex h-control-sm items-center justify-center rounded px-1.5 text-subtext hover:bg-surface hover:text-text disabled:cursor-default disabled:opacity-40"
        >
          <ArrowUp size={12} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Next ${noun}`}
          disabled={!canMoveNext}
          onClick={onMoveNext}
          className="inline-flex h-control-sm items-center justify-center rounded px-1.5 text-subtext hover:bg-surface hover:text-text disabled:cursor-default disabled:opacity-40"
        >
          <ArrowDown size={12} aria-hidden />
        </button>
        <IconButton label={`Close ${noun} detail`} onClick={onClose}>
          <X size={12} aria-hidden />
        </IconButton>
      </div>
      <div className="flex-1 overflow-y-auto">
        <EntityDetail item={item} />
      </div>
    </aside>
  );
}
