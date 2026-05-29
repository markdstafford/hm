import { useState } from "react";
import type { JiraProjectFilter, ResetJiraProjectCounts } from "../../../bindings";
import { resetJiraProjectData } from "../../../sources/storage";
import { Form } from "../../../ui/forms/Form";
import { Button } from "../../../ui/buttons/Button";
import { AlertDialog } from "../../../ui/overlays/AlertDialog";

interface ProjectResetSectionProps {
  sourceId: string;
  projects: JiraProjectFilter[];
}

type ResetState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; counts: ResetJiraProjectCounts }
  | { kind: "error"; message: string };

export function ProjectResetSection({ sourceId, projects }: ProjectResetSectionProps) {
  const [pendingProject, setPendingProject] = useState<JiraProjectFilter | null>(null);
  const [typedKey, setTypedKey] = useState("");
  const [resetState, setResetState] = useState<Record<string, ResetState>>({});

  function openDialog(project: JiraProjectFilter) {
    setPendingProject(project);
    setTypedKey("");
  }

  function closeDialog() {
    setPendingProject(null);
    setTypedKey("");
  }

  async function handleConfirm() {
    if (!pendingProject) return;
    const project = pendingProject;
    setResetState((prev) => ({ ...prev, [project.key]: { kind: "running" } }));
    closeDialog();
    const r = await resetJiraProjectData(sourceId, project.key);
    setResetState((prev) => ({
      ...prev,
      [project.key]: r.ok
        ? { kind: "done", counts: r.counts }
        : { kind: "error", message: r.error },
    }));
  }

  const confirmEnabled =
    pendingProject !== null && typedKey.trim() === pendingProject.key;

  return (
    <>
      <Form.Section
        label="Danger zone"
        description="Wipes every issue, event, snapshot, and cursor for a project so the next sync re-fetches it from scratch. The source itself and its credential are untouched."
      >
        <ul className="flex flex-col gap-2 m-0 p-0 list-none">
          {projects.map((project) => {
            const state = resetState[project.key] ?? { kind: "idle" };
            return (
              <li
                key={project.key}
                className="flex items-center justify-between gap-3 rounded border border-border bg-surface px-3 py-2 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-mono text-text">{project.key}</span>
                  {project.name && (
                    <span className="text-xs text-subtext">{project.name}</span>
                  )}
                  <ResetStatusLine state={state} />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => openDialog(project)}
                  disabled={state.kind === "running"}
                  aria-label={`Reset data for project ${project.key}`}
                >
                  {state.kind === "running" ? "Resetting…" : "Reset data"}
                </Button>
              </li>
            );
          })}
        </ul>
      </Form.Section>

      <AlertDialog.Root
        open={pendingProject !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <AlertDialog.Content>
          <AlertDialog.Title className="text-sm font-semibold text-text">
            Reset data for {pendingProject?.key}?
          </AlertDialog.Title>
          <AlertDialog.Description className="text-xs text-subtext mt-2">
            Every issue, event, snapshot, run, and cursor for{" "}
            <span className="font-mono">{pendingProject?.key}</span> will be
            deleted. Other projects on this source and the source's credential
            are untouched. The next sync will re-fetch the project from scratch.
          </AlertDialog.Description>
          <div className="mt-4">
            <label
              htmlFor="reset-confirm-key"
              className="block text-xs font-medium text-text mb-1"
            >
              Type{" "}
              <span className="font-mono">{pendingProject?.key}</span> to
              confirm
            </label>
            <input
              id="reset-confirm-key"
              type="text"
              value={typedKey}
              onChange={(e) => setTypedKey(e.target.value)}
              autoComplete="off"
              autoFocus
              className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm font-mono text-text"
            />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant="destructive"
                disabled={!confirmEnabled}
                onClick={(e) => {
                  if (!confirmEnabled) {
                    e.preventDefault();
                    return;
                  }
                  void handleConfirm();
                }}
              >
                Reset data
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  );
}

function ResetStatusLine({ state }: { state: ResetState }) {
  if (state.kind === "idle" || state.kind === "running") return null;
  if (state.kind === "error") {
    return (
      <span className="text-xs text-red mt-0.5">Reset failed: {state.message}</span>
    );
  }
  const c = state.counts;
  return (
    <span className="text-xs text-subtext mt-0.5">
      Reset complete — {c.work_items} issues, {c.issue_events} events,{" "}
      {c.issue_snapshots} snapshots, {c.ingestion_cursors} cursors,{" "}
      {c.ingestion_runs} runs deleted.
    </span>
  );
}
