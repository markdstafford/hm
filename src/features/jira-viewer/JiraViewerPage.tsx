import { FileText } from "lucide-react";
import { Breadcrumb } from "../../ui/navigation/Breadcrumb";
import { EmptyState } from "../../ui/feedback/EmptyState";

const titleBar = (
  <span className="flex items-center gap-2">
    <Breadcrumb items={[{ label: "Jira viewer", isCurrent: true }]} />
  </span>
);

const header = null;

const content = (
  <EmptyState
    icon={<FileText size={28} aria-hidden />}
    title="No issues yet"
    description="Connect a Jira source in Settings → Sources to start ingesting."
  />
);

export const JiraViewerPage = { titleBar, header, content };
