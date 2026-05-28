import { Badge } from "../../ui/data/Badge";
import { ConfidenceChip } from "../../ui/data/ConfidenceChip";
import { CheckCircle2, GitMerge, MessageCircleQuestion, PencilLine, UserRoundCog } from "lucide-react";
import type { ComponentType } from "react";
import type { HygieneAction, HygieneCategory, HygieneSuggestion, HygieneSuggestionProperty } from "./types";
import { actionLabel, categoryLabel, clampConfidence, derivedAssignee, derivedKey, derivedStatus } from "./properties";

type CellProps = { item: HygieneSuggestion; property: HygieneSuggestionProperty };

type IconProps = { size?: number; "aria-hidden"?: boolean | "true"; "data-testid"?: string };

const ACTION_ICONS: Record<HygieneAction, ComponentType<IconProps>> = {
  "close-as-resolved": CheckCircle2,
  "merge-as-duplicate": GitMerge,
  reassign: UserRoundCog,
  "ping-for-context": MessageCircleQuestion,
  "enrich-title-and-body": PencilLine,
};

const CATEGORY_TONES: Record<HygieneCategory, "neutral" | "primary" | "green" | "yellow" | "mauve" | "peach"> = {
  duplicate: "mauve",
  stale: "yellow",
  enrichment: "primary",
};

export function ActionCell({ item }: CellProps) {
  const Icon = ACTION_ICONS[item.action];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-text">
      <Icon size={13} aria-hidden data-testid={`hygiene-action-icon-${item.action}`} />
      <span>{actionLabel(item.action)}</span>
    </span>
  );
}

export function KeyCell({ item }: CellProps) {
  return <span className="font-mono text-xs text-subtext">{derivedKey(item)}</span>;
}

export function TitleCell({ item }: CellProps) {
  return <span className="truncate text-sm text-text">{item.target.title}</span>;
}

export function AssigneeCell({ item }: CellProps) {
  return <span className="text-xs text-subtext">{derivedAssignee(item)}</span>;
}

export function StatusCell({ item }: CellProps) {
  return <Badge tone="neutral">{derivedStatus(item)}</Badge>;
}

export function CategoryCell({ item }: CellProps) {
  return <Badge tone={CATEGORY_TONES[item.category]}>{categoryLabel(item.category)}</Badge>;
}

export function ConfidenceCell({ item }: CellProps) {
  return <ConfidenceChip value={clampConfidence(item.confidence)} />;
}

export function RationaleCell({ item }: CellProps) {
  return <span className="max-w-[24rem] truncate text-xs text-subtext">{item.rationale}</span>;
}
