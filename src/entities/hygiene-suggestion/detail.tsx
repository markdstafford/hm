import { Badge } from "../../ui/data/Badge";
import { ConfidenceChip } from "../../ui/data/ConfidenceChip";
import { Markdown } from "../../ui/text/Markdown";
import type { HygieneIssueRef, HygieneSuggestion } from "./types";
import { actionLabel, categoryLabel, clampConfidence } from "./properties";

type Props = { item: HygieneSuggestion };

const CATEGORY_TONES = {
  duplicate: "mauve" as const,
  stale: "yellow" as const,
  enrichment: "primary" as const,
};

function formatDate(value: string | null | undefined): string | null {
  return value?.slice(0, 10) || null;
}

function issueRefStatus(issue: HygieneIssueRef): string {
  return issue.status?.trim() || "No status";
}

function IssueCard({ title, issue }: { title?: string; issue: HygieneIssueRef }) {
  const updated = formatDate(issue.updatedAt);
  return (
    <section className="rounded-lg border border-border bg-surface/30 p-3">
      {title && <h3 className="mb-2 text-sm font-medium text-text">{title}</h3>}
      <p className="font-mono text-xs text-subtext">{issue.key}</p>
      <p className="mt-1 text-sm font-medium text-text">{issue.title}</p>
      <p className="mt-2 text-xs text-subtext">{issueRefStatus(issue)} · {issue.assignee?.trim() || "Unassigned"}</p>
      {updated && <p className="mt-1 text-xs text-subtext">updated {updated}</p>}
    </section>
  );
}

function DetailHeader({ item }: Props) {
  return (
    <header className="flex flex-col gap-2 border-b border-border/60 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={CATEGORY_TONES[item.category]}>{categoryLabel(item.category)}</Badge>
        <span className="text-subtext" aria-hidden>→</span>
        <span className="font-medium text-text">{actionLabel(item.action)}</span>
      </div>
      <div className="flex items-start gap-3">
        <h2 className="min-w-0 flex-1 text-base font-medium leading-snug text-text">
          <span className="font-mono text-sm">{item.target.key}</span> · {item.target.title}
        </h2>
        <ConfidenceChip value={clampConfidence(item.confidence)} />
      </div>
    </header>
  );
}

function Rationale({ item }: Props) {
  return (
    <section className="rounded-lg border border-border/60 bg-mantle/40 p-3">
      <h3 className="text-sm font-medium text-text">Rationale</h3>
      <p className="mt-1 text-sm text-subtext">{item.rationale}</p>
    </section>
  );
}

export function DuplicateDetail({ item }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <IssueCard title="This issue" issue={item.target} />
      <IssueCard title="Duplicate of" issue={item.duplicateOf ?? { key: "Unknown", title: "Canonical issue unavailable" }} />
    </div>
  );
}

export function StaleDetail({ item }: Props) {
  const activity = formatDate(item.lastActivityAt);
  return (
    <div className="flex flex-col gap-3">
      <IssueCard issue={item.target} />
      <p className="text-sm text-subtext">{activity ? `Last activity: ${activity}` : "Last activity unknown"}</p>
    </div>
  );
}

export function EnrichmentDetail({ item }: Props) {
  const proposed = item.proposed ?? {};
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <section className="rounded-lg border border-border bg-surface/30 p-3">
        <h3 className="text-sm font-medium text-text">Original</h3>
        <p className="mt-2 text-sm font-medium text-text">{item.target.title}</p>
        {item.target.body?.trim() ? (
          <Markdown source={item.target.body} className="mt-2" />
        ) : (
          <p className="mt-2 text-sm text-subtext">No body yet</p>
        )}
      </section>
      <section className="rounded-lg border border-primary/40 bg-primary/10 p-3">
        <h3 className="text-sm font-medium text-text">Proposed</h3>
        <p className="mt-2 text-sm font-medium text-text">{proposed.title || "No proposed title"}</p>
        {proposed.body?.trim() ? (
          <Markdown source={proposed.body} className="mt-2" />
        ) : (
          <p className="mt-2 text-sm text-subtext">No proposed body</p>
        )}
        {(proposed.labels?.length ?? 0) > 0 && (
          <p className="mt-2 text-xs text-subtext">Labels: {proposed.labels!.join(", ")}</p>
        )}
      </section>
    </div>
  );
}

export function SuggestionDetail({ item }: Props) {
  return (
    <article className="flex flex-col">
      <DetailHeader item={item} />
      <div className="flex flex-col gap-4 p-4">
        {item.category === "duplicate" ? (
          <DuplicateDetail item={item} />
        ) : item.category === "stale" ? (
          <StaleDetail item={item} />
        ) : (
          <EnrichmentDetail item={item} />
        )}
        <Rationale item={item} />
      </div>
    </article>
  );
}
