import { Search, Plus } from "lucide-react";
import { Avatar } from "../data/Avatar";
import { KeyboardShortcut } from "../navigation/KeyboardShortcut";

type Props = {
  name: string;
  initial?: string;
  onOpenSearch?: () => void;
};

export function ScopeHeader({ name, initial, onOpenSearch }: Props) {
  return (
    <div className="flex items-center gap-2 px-3 h-[var(--height-header-bar)] border-b border-border/30">
      <Avatar initial={initial ?? name.charAt(0)} />
      <span className="text-sm text-text font-medium flex-1 truncate">{name}</span>
      {onOpenSearch ? (
        <button
          type="button"
          aria-label="Search items"
          title="Search items"
          onClick={onOpenSearch}
          className="inline-flex items-center gap-1 rounded p-1 text-subtext hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Search size={12} aria-hidden />
          <KeyboardShortcut binding="⌘+k" className="hidden lg:inline-flex" />
        </button>
      ) : (
        <button
          type="button"
          disabled
          aria-label="Search (coming soon)"
          title="Search (coming soon)"
          className="p-1 rounded text-subtext/50 cursor-default"
        >
          <Search size={12} aria-hidden />
        </button>
      )}
      <button
        type="button"
        disabled
        aria-label="New (coming soon)"
        title="New (coming soon)"
        className="p-1 rounded text-subtext/50 cursor-default"
      >
        <Plus size={12} aria-hidden />
      </button>
    </div>
  );
}
