import { formatBinding, type Platform } from "../../shell/keys";

type Props = {
  binding: string | string[];
  platform?: Platform;
  className?: string;
};

export function KeyboardShortcut({ binding, platform, className = "" }: Props) {
  const parts = Array.isArray(binding) ? binding : [binding];
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-subtext text-xs">then</span>}
          <kbd className="rounded border border-border bg-surface px-1 text-xs text-subtext font-mono">
            {formatBinding(p, platform)}
          </kbd>
        </span>
      ))}
    </span>
  );
}
