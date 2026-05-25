import { Inbox } from "lucide-react";
import { Breadcrumb } from "../../ui/navigation/Breadcrumb";
import { EmptyState } from "../../ui/feedback/EmptyState";

const titleBar = (
  <span className="flex items-center gap-2">
    <Breadcrumb items={[{ label: "Inbox", isCurrent: true }]} />
    <span className="text-xs text-subtext tabular-nums">0</span>
  </span>
);

const header = null;

const content = (
  <EmptyState
    icon={<Inbox size={28} aria-hidden />}
    title="Inbox is clear"
    description="Nothing to triage right now."
  />
);

export const InboxPage = { titleBar, header, content };
