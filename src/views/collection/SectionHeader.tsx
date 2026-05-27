import { ChevronDown, ChevronRight } from "lucide-react";

type Props = {
  bucketKey: string;
  label: string;
  count: number;
  collapsed: boolean;
  onToggleCollapsed: (bucketKey: string) => void;
};

export function SectionHeader({ bucketKey, label, count, collapsed, onToggleCollapsed }: Props) {
  const action = collapsed ? "Expand" : "Collapse";
  const Icon = collapsed ? ChevronRight : ChevronDown;

  return (
    <div className="flex items-center gap-2 border-y border-border/50 bg-mantle/60 px-3 py-1 text-xs text-subtext">
      <button
        type="button"
        aria-label={`${action} ${label}`}
        aria-expanded={!collapsed}
        onClick={() => onToggleCollapsed(bucketKey)}
        className="inline-flex h-control-sm w-control-sm items-center justify-center rounded hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Icon size={12} aria-hidden />
      </button>
      <span className="flex-1 text-text" style={{ fontVariantCaps: "all-small-caps" }}>
        {label}
      </span>
      <span className="font-mono tabular-nums text-subtext">{count}</span>
    </div>
  );
}
