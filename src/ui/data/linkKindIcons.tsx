import type { LucideIcon } from "lucide-react";
import { Link2, Network, Sparkles } from "lucide-react";

export type LinkKind = "source" | "local" | "suggested";

export const LINK_KINDS: LinkKind[] = ["source", "local", "suggested"];

export const LINK_KIND_META: Record<
  LinkKind,
  { label: string; description: string; Icon: LucideIcon }
> = {
  source: {
    label: "Source link",
    description: "Stored in the source system",
    Icon: Link2,
  },
  local: {
    label: "Local link",
    description: "Stored only in hm",
    Icon: Network,
  },
  suggested: {
    label: "Suggested link",
    description: "Computed related item",
    Icon: Sparkles,
  },
};
