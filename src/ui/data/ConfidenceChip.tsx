import { SecondaryHighlightChip } from "./SecondaryHighlightChip";

type Props = { value: number; className?: string };

export function ConfidenceChip({ value, className = "" }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const high = clamped >= 85;
  return (
    <SecondaryHighlightChip
      className={className}
      data-confidence={high ? "high" : "low"}
    >
      <span>{clamped}%</span>
    </SecondaryHighlightChip>
  );
}
