import {
  LayoutTemplate,
  ListChecks,
  ArrowUpDown,
  Rows3,
  Filter,
  Palette,
  ChevronRight,
} from "lucide-react";
import { PanelHeader } from "./PanelHeader";
import { Field } from "../../../ui/forms/Field";
import { TextField } from "../../../ui/forms/TextField";
import type { ViewConfigSummary } from "../ViewConfig";
import type { ViewSettingsPanel } from "./types";

type TopSheetProps = {
  viewName: string;
  draftName: string;
  renameError: string | null;
  onDraftNameChange: (value: string) => void;
  onCommitRename: () => void;
  onNavigate: (panel: ViewSettingsPanel) => void;
  onClose: () => void;
  summary: ViewConfigSummary;
};

export function TopSheet({
  draftName,
  renameError,
  onDraftNameChange,
  onCommitRename,
  onNavigate,
  onClose,
  summary,
}: TopSheetProps) {
  return (
    <>
      <PanelHeader title="View settings" onClose={onClose} />
      <div className="px-3 py-2 flex flex-col gap-3">
        <Field label="View name" error={renameError ?? undefined}>
          {({ id, describedBy }) => (
            <TextField
              id={id}
              value={draftName}
              invalid={!!renameError}
              aria-describedby={describedBy}
              onChange={(e) => onDraftNameChange(e.target.value)}
              onBlur={onCommitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onCommitRename();
                }
              }}
            />
          )}
        </Field>
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => onNavigate("layout")}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface"
          >
            <LayoutTemplate size={14} className="shrink-0 text-subtext" />
            <span className="flex-1 text-left text-text">Layout</span>
            <span className="text-xs text-subtext">{summary.layout}</span>
            <ChevronRight size={12} className="shrink-0 text-subtext" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate("property-visibility")}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface"
          >
            <ListChecks size={14} className="shrink-0 text-subtext" />
            <span className="flex-1 text-left text-text">Property visibility</span>
            <span className="text-xs text-subtext">{summary.propertyVisibility}</span>
            <ChevronRight size={12} className="shrink-0 text-subtext" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate("sort")}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface"
          >
            <ArrowUpDown size={14} className="shrink-0 text-subtext" />
            <span className="flex-1 text-left text-text">Sort</span>
            <span className="text-xs text-subtext">{summary.sort}</span>
            <ChevronRight size={12} className="shrink-0 text-subtext" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate("group")}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface"
          >
            <Rows3 size={14} className="shrink-0 text-subtext" />
            <span className="flex-1 text-left text-text">Group</span>
            <span className="text-xs text-subtext">{summary.group}</span>
            <ChevronRight size={12} className="shrink-0 text-subtext" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate("filter")}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface"
          >
            <Filter size={14} className="shrink-0 text-subtext" />
            <span className="flex-1 text-left text-text">Filter</span>
            <span className="text-xs text-subtext">{summary.filter}</span>
            <ChevronRight size={12} className="shrink-0 text-subtext" />
          </button>
          <div
            aria-disabled="true"
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm opacity-50 cursor-default"
          >
            <Palette size={14} className="shrink-0 text-subtext" />
            <span className="flex-1 text-left text-text">Conditional color</span>
            <span className="text-xs text-subtext">Soon</span>
          </div>
        </div>
      </div>
    </>
  );
}
