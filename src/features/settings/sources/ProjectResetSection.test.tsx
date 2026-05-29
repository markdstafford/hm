import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { ProjectResetSection } from "./ProjectResetSection";
import { commands } from "../../../bindings";

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).PointerEvent = window.MouseEvent;
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.setPointerCapture) {
    window.HTMLElement.prototype.setPointerCapture = () => {};
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__TAURI_INTERNALS__ = {};
});

vi.mock("../../../bindings", () => ({
  commands: {
    jiraSourceResetProjectData: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const PROJECTS = [
  { key: "AMP", name: "Application Modernization Platform", id: "10001" },
  { key: "OTHER", name: "Other Project", id: "10002" },
];

const EMPTY_COUNTS = {
  work_items: 0,
  work_item_terms: 0,
  work_item_relationships: 0,
  work_item_comments: 0,
  jira_issues: 0,
  jira_issue_field_values: 0,
  jira_worklogs: 0,
  jira_remote_links: 0,
  jira_project_field_mappings: 0,
  issue_events: 0,
  issue_snapshots: 0,
  document_embeddings: 0,
  indexable_documents: 0,
  ingestion_cursors: 0,
  ingestion_runs: 0,
};

describe("ProjectResetSection", () => {
  it("lists every configured project with a Reset button", () => {
    render(<ProjectResetSection sourceId="src_1" projects={PROJECTS} />);
    expect(
      screen.getByRole("button", { name: /Reset data for project AMP/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Reset data for project OTHER/i }),
    ).toBeInTheDocument();
  });

  it("disables the confirm button until the project key is typed verbatim", async () => {
    const user = userEvent.setup();
    render(<ProjectResetSection sourceId="src_1" projects={PROJECTS} />);

    await user.click(
      screen.getByRole("button", { name: /Reset data for project AMP/i }),
    );

    const confirmButton = screen.getByRole("button", { name: "Reset data" });
    expect(confirmButton).toBeDisabled();

    const input = screen.getByLabelText(/Type AMP to confirm/i);
    await user.type(input, "amp");
    expect(confirmButton).toBeDisabled();

    await user.clear(input);
    await user.type(input, "AMP");
    expect(confirmButton).toBeEnabled();
  });

  it("calls the backend with the correct (source, project) and shows counts", async () => {
    vi.mocked(commands.jiraSourceResetProjectData).mockResolvedValue({
      status: "ok",
      data: {
        ...EMPTY_COUNTS,
        work_items: 12,
        issue_events: 34,
        issue_snapshots: 56,
        ingestion_cursors: 2,
        ingestion_runs: 1,
      },
    });

    const user = userEvent.setup();
    render(<ProjectResetSection sourceId="src_1" projects={PROJECTS} />);

    await user.click(
      screen.getByRole("button", { name: /Reset data for project AMP/i }),
    );
    await user.type(screen.getByLabelText(/Type AMP to confirm/i), "AMP");
    await user.click(screen.getByRole("button", { name: "Reset data" }));

    await waitFor(() =>
      expect(commands.jiraSourceResetProjectData).toHaveBeenCalledWith(
        "src_1",
        "AMP",
      ),
    );

    expect(
      await screen.findByText(
        /Reset complete — 12 issues, 34 events, 56 snapshots, 2 cursors, 1 runs deleted\./,
      ),
    ).toBeInTheDocument();
  });

  it("surfaces backend errors per-project without affecting other projects", async () => {
    vi.mocked(commands.jiraSourceResetProjectData).mockResolvedValue({
      status: "error",
      error: "database is locked",
    });

    const user = userEvent.setup();
    render(<ProjectResetSection sourceId="src_1" projects={PROJECTS} />);

    await user.click(
      screen.getByRole("button", { name: /Reset data for project AMP/i }),
    );
    await user.type(screen.getByLabelText(/Type AMP to confirm/i), "AMP");
    await user.click(screen.getByRole("button", { name: "Reset data" }));

    expect(
      await screen.findByText(/Reset failed: database is locked/i),
    ).toBeInTheDocument();

    // The OTHER project's row is unaffected.
    expect(
      screen.getByRole("button", { name: /Reset data for project OTHER/i }),
    ).toBeEnabled();
  });
});
