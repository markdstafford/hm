import { Breadcrumb } from "../../ui/navigation/Breadcrumb";
import { Tag } from "../../ui/data/Tag";

const ROWS = [
  { id: "1", title: "Duplicate of ABC-123" },
  { id: "2", title: "Stale: no update in 90 days" },
  { id: "3", title: "Needs enrichment" },
];

const titleBar = (
  <span className="flex items-center gap-2">
    <Breadcrumb items={[{ label: "Backlog hygiene", isCurrent: true }]} />
    <span className="text-xs text-subtext tabular-nums">{ROWS.length}</span>
  </span>
);

const header = (
  <div className="flex items-center gap-2">
    <Tag>All</Tag>
    <Tag>Duplicates</Tag>
    <Tag>Stale</Tag>
    <Tag>Enrichment</Tag>
  </div>
);

const content = (
  <ul className="divide-y divide-border">
    {ROWS.map((r) => (
      <li key={r.id} className="px-3 py-2 text-sm text-text hover:bg-surface/40">
        {r.title}
      </li>
    ))}
  </ul>
);

export const BacklogHygienePage = { titleBar, header, content };
