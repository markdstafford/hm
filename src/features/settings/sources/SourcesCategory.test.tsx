import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { SourcesCategory } from "./SourcesCategory";
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
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__TAURI_INTERNALS__ = {};
});

vi.mock("../../../bindings", () => ({
  commands: {
    sourceConfigGet: vi.fn(),
    sourceConfigSave: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    sourceCredentialSecretSet: vi
      .fn()
      .mockResolvedValue({ status: "ok", data: "source.jira.test.pat" }),
    sourceCredentialDelete: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    sourceConfigRemove: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    jiraSourceTestConnection: vi.fn().mockResolvedValue({
      status: "ok",
      data: {
        status: "Unavailable",
        tested_at: "2024-01-01T00:00:00Z",
        message: "Live connection testing is not available in this environment.",
        suggested_fix: null,
        projects: [],
        category: "Unavailable",
      },
    }),
    jiraIssueIngestionRun: vi.fn().mockResolvedValue({
      status: "ok",
      data: { run_id: "run_1", status: "succeeded", saved_issues: 0, total_issues: null },
    }),
    jiraIssueIngestionCancel: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    jiraIssueIngestionProgress: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    jiraIssueIngestionStatus: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  },
}));

const JIRA_SOURCE = {
  kind: "Jira" as const,
  id: "src_jira_1",
  name: "AMP Data Center",
  enabled: true,
  server_url: "https://jira.example.invalid",
  auth: { type: "Pat" as const, credential_ref: "source.jira.src_jira_1.pat" },
  projects: [{ key: "AMP", name: "AMP", id: "10000" }],
  last_connection_test: null,
  created_at: "2026-05-25T00:00:00Z",
  updated_at: "2026-05-25T00:00:00Z",
};

describe("SourcesCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(commands.sourceConfigGet).mockResolvedValue({
      status: "ok",
      data: { version: 1, sources: [] },
    });
    vi.mocked(commands.jiraIssueIngestionProgress).mockResolvedValue({
      status: "ok",
      data: null,
    });
  });

  it("renders the empty state when no sources are configured", async () => {
    render(<SourcesCategory />);
    await waitFor(() =>
      expect(screen.getByText(/Add your first source/i)).toBeInTheDocument(),
    );
  });

  it("opens the Add source flow when the button is clicked", async () => {
    render(<SourcesCategory />);
    await waitFor(() => screen.getByText(/Add source/i));
    await userEvent.click(screen.getByRole("button", { name: /^Add source$/ }));
    expect(await screen.findByText(/Jira Data Center/)).toBeInTheDocument();
  });

  it("moves into the Jira form when the Jira kind is picked", async () => {
    render(<SourcesCategory />);
    await waitFor(() => screen.getByText(/Add source/i));
    await userEvent.click(screen.getByRole("button", { name: /^Add source$/ }));
    await userEvent.click(await screen.findByRole("button", { name: /Jira Data Center/ }));
    expect(
      await screen.findByRole("form", { name: /Add Jira source/i }),
    ).toBeInTheDocument();
  });

  it("shows Jira issue sync progress on the source row", async () => {
    vi.mocked(commands.sourceConfigGet).mockResolvedValue({
      status: "ok",
      data: { version: 1, sources: [JIRA_SOURCE] },
    });
    vi.mocked(commands.jiraIssueIngestionProgress).mockResolvedValue({
      status: "ok",
      data: {
        run_id: "run_1",
        status: "running",
        phase: "fetching comments",
        saved_issues: 48,
        total_issues: 63,
        current_page: 3,
        total_pages: 4,
        message: "Syncing issues",
        last_successful_issue_sync_at: null,
        error_summary: null,
      },
    });
    render(<SourcesCategory />);
    expect(await screen.findByText(/48 of 63 issues saved/i)).toBeInTheDocument();
    expect(screen.getByText(/Syncing issues/i)).toBeInTheDocument();
  });

  it("renders backend Jira issue sync error summaries on the source row", async () => {
    vi.mocked(commands.sourceConfigGet).mockResolvedValue({
      status: "ok",
      data: { version: 1, sources: [JIRA_SOURCE] },
    });
    vi.mocked(commands.jiraIssueIngestionProgress).mockResolvedValue({
      status: "ok",
      data: {
        run_id: "run_2",
        status: "partial",
        phase: "searching",
        saved_issues: 48,
        total_issues: 63,
        current_page: 3,
        total_pages: 4,
        message: "Partial sync",
        last_successful_issue_sync_at: null,
        error_summary: "Jira server error",
      },
    });

    render(<SourcesCategory />);

    expect(await screen.findByText(/Status: Partial sync/i)).toBeInTheDocument();
    expect(screen.getByText("Error: Jira server error")).toBeInTheDocument();
    expect(screen.queryByText(/Unknown error/i)).not.toBeInTheDocument();
  });

  it("runs and cancels sync from the source row", async () => {
    vi.mocked(commands.sourceConfigGet).mockResolvedValue({
      status: "ok",
      data: { version: 1, sources: [JIRA_SOURCE] },
    });
    let callCount = 0;
    vi.mocked(commands.jiraIssueIngestionProgress).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { status: "ok", data: null };
      }
      return {
        status: "ok",
        data: {
          run_id: "run_99",
          status: "running",
          phase: "searching",
          saved_issues: 2,
          total_issues: 5,
          current_page: 1,
          total_pages: 3,
          message: "Syncing issues",
          last_successful_issue_sync_at: null,
          error_summary: null,
        },
      };
    });

    render(<SourcesCategory />);
    const runButton = await screen.findByRole("button", { name: /Run sync now/i });
    await userEvent.click(runButton);
    await waitFor(() =>
      expect(commands.jiraIssueIngestionRun).toHaveBeenCalledWith(JIRA_SOURCE.id, null),
    );

    const cancelButton = await screen.findByRole("button", { name: /Cancel sync/i });
    await userEvent.click(cancelButton);
    await waitFor(() =>
      expect(commands.jiraIssueIngestionCancel).toHaveBeenCalledWith(
        JIRA_SOURCE.id,
        "run_99",
      ),
    );
  });

  it("shows live progress and Cancel sync while jira_issue_ingestion_run is still pending", async () => {
    vi.mocked(commands.sourceConfigGet).mockResolvedValue({
      status: "ok",
      data: { version: 1, sources: [JIRA_SOURCE] },
    });
    // jiraIssueIngestionRun never resolves during this test, simulating the
    // synchronous Rust command blocking for the full ingestion duration.
    vi.mocked(commands.jiraIssueIngestionRun).mockImplementation(
      () => new Promise(() => {}),
    );
    let progressCalls = 0;
    vi.mocked(commands.jiraIssueIngestionProgress).mockImplementation(async () => {
      progressCalls += 1;
      if (progressCalls === 1) return { status: "ok", data: null };
      return {
        status: "ok",
        data: {
          run_id: "run_pending_1",
          status: "running",
          phase: "searching",
          saved_issues: 3,
          total_issues: 10,
          current_page: 1,
          total_pages: 2,
          message: "Syncing issues",
          last_successful_issue_sync_at: null,
          error_summary: null,
        },
      };
    });

    render(<SourcesCategory />);
    const runButton = await screen.findByRole("button", { name: /Run sync now/i });
    await userEvent.click(runButton);

    // Cancel button must appear without waiting for the run promise to resolve.
    const cancelButton = await screen.findByRole("button", { name: /Cancel sync/i });
    expect(cancelButton).toBeInTheDocument();
    expect(screen.getByText(/3 of 10 issues saved/i)).toBeInTheDocument();

    // Click Cancel and assert it uses run_id from the progress response.
    await userEvent.click(cancelButton);
    await waitFor(() =>
      expect(commands.jiraIssueIngestionCancel).toHaveBeenCalledWith(
        JIRA_SOURCE.id,
        "run_pending_1",
      ),
    );
  });

  it("shows Status: Synced without a Progress line after a no-op succeeded sync", async () => {
    vi.mocked(commands.sourceConfigGet).mockResolvedValue({
      status: "ok",
      data: { version: 1, sources: [JIRA_SOURCE] },
    });
    vi.mocked(commands.jiraIssueIngestionProgress).mockResolvedValue({
      status: "ok",
      data: {
        run_id: "run_noop",
        status: "succeeded",
        phase: null,
        saved_issues: 0,
        total_issues: 0,
        current_page: null,
        total_pages: null,
        message: "Synced",
        last_successful_issue_sync_at: null,
        error_summary: null,
      },
    });
    render(<SourcesCategory />);
    expect(await screen.findByText(/Status: Synced/i)).toBeInTheDocument();
    expect(screen.queryByText(/Progress:/i)).not.toBeInTheDocument();
  });

  it("does not render credential refs or PAT-shaped text in source rows", async () => {
    vi.mocked(commands.sourceConfigGet).mockResolvedValue({
      status: "ok",
      data: { version: 1, sources: [JIRA_SOURCE] },
    });
    render(<SourcesCategory />);
    await screen.findByText(/AMP Data Center/i);
    expect(screen.queryByText(/source\.jira\..*\.pat/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/bearer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/authorization/i)).not.toBeInTheDocument();
  });
});
