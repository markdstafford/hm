type Props = {
  label: string;
  totalCount: number;
  matchingCount: number;
  backLabel: string;
  onBack: () => void;
};

function countCopy(totalCount: number, matchingCount: number): string {
  if (matchingCount !== totalCount) {
    return `${matchingCount} matching of ${totalCount} related ${totalCount === 1 ? "item" : "items"}`;
  }
  return `${totalCount} related ${totalCount === 1 ? "item" : "items"}`;
}

export function ReRootBanner({ label, totalCount, matchingCount, backLabel, onBack }: Props) {
  return (
    <div role="status" className="flex shrink-0 items-center gap-3 border-b border-border bg-surface/40 px-3 py-2 text-sm text-text">
      <div className="min-w-0 flex-1">
        <span className="font-medium">{label}</span>
        <span className="ml-2 text-xs text-subtext">{countCopy(totalCount, matchingCount)}</span>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="shrink-0 rounded px-2 py-1 text-xs text-subtext hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {backLabel}
      </button>
    </div>
  );
}
