import { render, screen, fireEvent } from "@testing-library/react";
import { vi, beforeAll } from "vitest";
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

import { useJiraIssues } from "./data";

describe("CollectionViewerPage", () => {
  it("shows loading spinner while loading", () => {
    vi.mocked(useJiraIssues).mockReturnValue({ issues: [], loading: true, error: null });
    render(<CollectionViewerPage />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows empty state when no issues", () => {
    vi.mocked(useJiraIssues).mockReturnValue({ issues: [], loading: false, error: null });
    render(<CollectionViewerPage />);
    expect(screen.getByText(/no jira issues yet/i)).toBeInTheDocument();
    expect(screen.getByText(/run jira ingestion/i)).toBeInTheDocument();
  });

  it("shows error message when error is present", () => {
    vi.mocked(useJiraIssues).mockReturnValue({ issues: [], loading: false, error: "connection failed" });
    render(<CollectionViewerPage />);
    expect(screen.getByText(/could not load jira issues/i)).toBeInTheDocument();
  });

  it("renders issue rows when issues are loaded", () => {
    vi.mocked(useJiraIssues).mockReturnValue({ issues: mockIssues, loading: false, error: null });
    render(<CollectionViewerPage />);
    expect(screen.getByText("AMP-1")).toBeInTheDocument();
    expect(screen.getByText("First issue")).toBeInTheDocument();
    expect(screen.getByText("AMP-2")).toBeInTheDocument();
    expect(screen.getByText("Second issue")).toBeInTheDocument();
  });

  it("opens detail rail when a row is clicked", () => {
    vi.mocked(useJiraIssues).mockReturnValue({ issues: mockIssues, loading: false, error: null });
    render(<CollectionViewerPage />);
    fireEvent.click(screen.getByRole("button", { name: /open amp-1: first issue/i }));
    expect(screen.getByRole("button", { name: /close issue detail/i })).toBeInTheDocument();
  });

  it("hides detail rail when close button is clicked", () => {
    vi.mocked(useJiraIssues).mockReturnValue({ issues: mockIssues, loading: false, error: null });
    render(<CollectionViewerPage />);
    fireEvent.click(screen.getByRole("button", { name: /open amp-1: first issue/i }));
    expect(screen.getByRole("button", { name: /close issue detail/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /close issue detail/i }));
    expect(screen.queryByRole("button", { name: /close issue detail/i })).not.toBeInTheDocument();
  });

  it("swaps detail content when a second row is clicked", () => {
    vi.mocked(useJiraIssues).mockReturnValue({ issues: mockIssues, loading: false, error: null });
    render(<CollectionViewerPage />);
    fireEvent.click(screen.getByRole("button", { name: /open amp-1: first issue/i }));
    const details = screen.getAllByText("First issue");
    expect(details.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole("button", { name: /open amp-2: second issue/i }));
    expect(screen.getAllByText("Second issue").length).toBeGreaterThanOrEqual(1);
  });

  it("passes accessibility check", async () => {
    vi.mocked(useJiraIssues).mockReturnValue({ issues: mockIssues, loading: false, error: null });
    const { container } = render(<CollectionViewerPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
