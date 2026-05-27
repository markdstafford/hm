import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, beforeAll, describe, it, expect, beforeEach } from "vitest";
import { axe } from "jest-axe";
import { CollectionViewerPage } from "./CollectionViewerPage";
import type { JiraIssueListItem } from "../../bindings";

beforeAll(() => {
  (globalThis as any).PointerEvent = window.MouseEvent;
  if (!window.HTMLElement.prototype.hasPointerCapture)
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  if (!window.HTMLElement.prototype.releasePointerCapture)
    window.HTMLElement.prototype.releasePointerCapture = () => {};
  if (!window.HTMLElement.prototype.setPointerCapture)
    window.HTMLElement.prototype.setPointerCapture = () => {};
  if (!window.HTMLElement.prototype.scrollIntoView)
    window.HTMLElement.prototype.scrollIntoView = () => {};
});

const mockIssues: JiraIssueListItem[] = [
  {
    work_item_id: "wid-1",
    key: "AMP-1",
    title: "First issue",
    status_name: "Open",
    assignee_display_name: "Alice",
    updated_at_source: "2024-06-01T10:00:00Z",
    project_key: "AMP",
  },
  {
    work_item_id: "wid-2",
    key: "AMP-2",
    title: "Second issue",
    status_name: "Done",
    assignee_display_name: "Bob",
    updated_at_source: "2024-01-01T10:00:00Z",
    project_key: "AMP",
  },
];

vi.mock("./data", () => ({
  useJiraIssues: vi.fn(),
}));

vi.mock("../../bindings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../bindings")>();
  return {
    ...actual,
    commands: {
      ...actual.commands,
      collectionViewsList: vi.fn(),
      collectionViewSave: vi.fn(),
      collectionViewDelete: vi.fn(),
      collectionViewsSeedDefaults: vi.fn(),
    },
  };
});

vi.mock("../../preferences/storage", () => ({
  loadPreferences: vi.fn(),
  savePreferences: vi.fn(),
}));

import { useJiraIssues } from "./data";
import { commands } from "../../bindings";
import { loadPreferences, savePreferences } from "../../preferences/storage";

const defaultViewRecords = [
  { id: "jira-issue-all-open", entity_kind: "jira-issue", display_name: "All open", position: 0, is_default: true, config: {} },
  { id: "jira-issue-mine", entity_kind: "jira-issue", display_name: "Mine", position: 1, is_default: true, config: {} },
  { id: "jira-issue-recently-updated", entity_kind: "jira-issue", display_name: "Recently updated", position: 2, is_default: true, config: {} },
];

function mockViewCommands(records = defaultViewRecords) {
  vi.mocked(commands.collectionViewsSeedDefaults).mockResolvedValue({ status: "ok", data: records });
  vi.mocked(commands.collectionViewsList).mockResolvedValue({ status: "ok", data: records });
  vi.mocked(commands.collectionViewSave).mockImplementation(async (view: any) => ({
    status: "ok",
    data: {
      id: view.id,
      entity_kind: view.entity_kind,
      display_name: view.display_name,
      position: view.position,
      is_default: view.is_default,
      config: view.config,
    },
  }));
  vi.mocked(commands.collectionViewDelete).mockResolvedValue({ status: "ok", data: null });
  vi.mocked(loadPreferences).mockResolvedValue({});
  vi.mocked(savePreferences).mockImplementation(async (current: any, patch: any) => ({
    ok: true,
    next: { ...current, ...patch },
  }));
}

describe("CollectionViewerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockViewCommands();
    (window as any).__TAURI_INTERNALS__ = { invoke: vi.fn() };
  });

  it("shows loading spinner while loading", () => {
    vi.mocked(useJiraIssues).mockReturnValue({ issues: [], loading: true, error: null });
    render(<CollectionViewerPage />);
    expect(screen.getAllByRole("status").length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty state when no issues", async () => {
    vi.mocked(useJiraIssues).mockReturnValue({ issues: [], loading: false, error: null });
    render(<CollectionViewerPage />);
    expect(await screen.findByText(/no jira issues yet/i)).toBeInTheDocument();
    expect(screen.getByText(/run jira ingestion/i)).toBeInTheDocument();
  });

  it("shows error message when error is present", async () => {
    vi.mocked(useJiraIssues).mockReturnValue({ issues: [], loading: false, error: "connection failed" });
    render(<CollectionViewerPage />);
    expect(await screen.findByText(/could not load jira issues/i)).toBeInTheDocument();
  });

  it("renders issue rows when issues are loaded", async () => {
    vi.mocked(useJiraIssues).mockReturnValue({ issues: mockIssues, loading: false, error: null });
    render(<CollectionViewerPage />);
    expect(await screen.findByText("AMP-1")).toBeInTheDocument();
    expect(screen.getByText("First issue")).toBeInTheDocument();
    expect(screen.getByText("AMP-2")).toBeInTheDocument();
    expect(screen.getByText("Second issue")).toBeInTheDocument();
  });

  it("opens detail rail when a row is clicked", async () => {
    vi.mocked(useJiraIssues).mockReturnValue({ issues: mockIssues, loading: false, error: null });
    render(<CollectionViewerPage />);
    fireEvent.click(await screen.findByRole("button", { name: /open amp-1: first issue/i }));
    expect(screen.getByRole("button", { name: /close issue detail/i })).toBeInTheDocument();
  });

  it("hides detail rail when close button is clicked", async () => {
    vi.mocked(useJiraIssues).mockReturnValue({ issues: mockIssues, loading: false, error: null });
    render(<CollectionViewerPage />);
    fireEvent.click(await screen.findByRole("button", { name: /open amp-1: first issue/i }));
    expect(screen.getByRole("button", { name: /close issue detail/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /close issue detail/i }));
    expect(screen.queryByRole("button", { name: /close issue detail/i })).not.toBeInTheDocument();
  });

  it("swaps detail content when a second row is clicked", async () => {
    vi.mocked(useJiraIssues).mockReturnValue({ issues: mockIssues, loading: false, error: null });
    render(<CollectionViewerPage />);
    fireEvent.click(await screen.findByRole("button", { name: /open amp-1: first issue/i }));
    const details = screen.getAllByText("First issue");
    expect(details.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole("button", { name: /open amp-2: second issue/i }));
    expect(screen.getAllByText("Second issue").length).toBeGreaterThanOrEqual(1);
  });

  it("passes accessibility check", async () => {
    vi.mocked(useJiraIssues).mockReturnValue({ issues: mockIssues, loading: false, error: null });
    const { container } = render(<CollectionViewerPage />);
    await screen.findByRole("button", { name: "All open" });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("shows Jira default view chips after seeding", async () => {
    vi.mocked(useJiraIssues).mockReturnValue({ issues: mockIssues, loading: false, error: null });
    render(<CollectionViewerPage />);
    expect(await screen.findByRole("button", { name: "All open" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Mine" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recently updated" })).toBeInTheDocument();
  });

  it("restores active view from preferences", async () => {
    vi.mocked(loadPreferences).mockResolvedValue({ collections: { activeViewId: { "jira-issue": "jira-issue-mine" } } });
    vi.mocked(useJiraIssues).mockReturnValue({ issues: mockIssues, loading: false, error: null });
    render(<CollectionViewerPage />);
    expect(await screen.findByRole("button", { name: "Mine" })).toHaveAttribute("aria-current", "true");
  });

  it("switches active chip and saves active preference", async () => {
    vi.mocked(useJiraIssues).mockReturnValue({ issues: mockIssues, loading: false, error: null });
    render(<CollectionViewerPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Mine" }));
    expect(screen.getByRole("button", { name: "Mine" })).toHaveAttribute("aria-current", "true");
    expect(savePreferences).toHaveBeenCalledWith(expect.any(Object), {
      collections: { activeViewId: { "jira-issue": "jira-issue-mine" } },
    });
  });

  it("creates a new view from the active view and activates it", async () => {
    vi.mocked(useJiraIssues).mockReturnValue({ issues: mockIssues, loading: false, error: null });
    render(<CollectionViewerPage />);
    fireEvent.click(await screen.findByRole("button", { name: /create named view/i }));
    await waitFor(() => {
      expect(commands.collectionViewSave).toHaveBeenCalledWith(expect.objectContaining({ display_name: "Untitled view" }));
    });
    expect(await screen.findByRole("button", { name: "Untitled view" })).toHaveAttribute("aria-current", "true");
  });

  it("deletes the active view and selects a safe fallback", async () => {
    vi.mocked(useJiraIssues).mockReturnValue({ issues: mockIssues, loading: false, error: null });
    render(<CollectionViewerPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Mine" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Mine" })).toHaveAttribute("aria-current", "true"));
    fireEvent.contextMenu(screen.getByRole("button", { name: "Mine" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    fireEvent.click(await screen.findByRole("button", { name: /delete view/i }));
    expect(commands.collectionViewDelete).toHaveBeenCalledWith("jira-issue-mine");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "All open" })).toHaveAttribute("aria-current", "true");
    });
  });
});
