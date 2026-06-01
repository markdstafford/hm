import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { beforeAll, beforeEach, describe, it, expect, vi } from "vitest";
import App from "./App";

const mockUseJiraIssues = vi.fn().mockReturnValue({ issues: [], loading: false, error: null });

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
});

vi.mock("./bindings", () => ({
  commands: {
    appStatus: vi.fn().mockResolvedValue({ version: "0.1.0", ready: true }),
    preferencesRead: vi.fn().mockResolvedValue({ status: "ok", data: {} }),
    preferencesWrite: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    jiraIssuesList: vi.fn().mockResolvedValue({ status: "ok", data: [] }),
    collectionViewsSeedDefaults: vi.fn().mockResolvedValue({ status: "ok", data: [] }),
    collectionViewSave: vi.fn().mockImplementation(async (v: any) => ({ status: "ok", data: v })),
    collectionViewDelete: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  },
}));

vi.mock("./preferences/storage", () => ({
  loadPreferences: vi.fn().mockResolvedValue({}),
  savePreferences: vi.fn().mockImplementation(async (c: any, p: any) => ({ ok: true, next: { ...c, ...p } })),
}));

vi.mock("./features/backlog-hygiene/data", () => ({
  useHygieneSuggestions: vi.fn().mockReturnValue({ suggestions: [], loading: false, error: null, partialFailures: [] }),
}));

vi.mock("./features/collection-viewer/data", () => ({
  useJiraIssues: () => mockUseJiraIssues(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    setSize: vi.fn(),
    setPosition: vi.fn(),
    innerSize: vi.fn().mockResolvedValue({ width: 1200, height: 800 }),
    outerPosition: vi.fn().mockResolvedValue({ x: 100, y: 100 }),
    onMoved: vi.fn().mockResolvedValue(() => {}),
    onResized: vi.fn().mockResolvedValue(() => {}),
  })),
  LogicalSize: vi.fn(),
  LogicalPosition: vi.fn(),
}));

describe("App", () => {
  it("renders the Inbox empty state", () => {
    render(<App />);
    expect(screen.getByText(/inbox is clear/i)).toBeInTheDocument();
  });

  it("renders the settings opener button", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /open settings/i })).toBeInTheDocument();
  });

  it("flips into the settings page mode when opener is clicked", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /open settings/i }));
    expect(screen.getByRole("button", { name: /Close settings/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "General" })).toBeInTheDocument();
  });

  it("has no accessibility violations on initial render", async () => {
    const { container } = render(<App />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("applies canonical primary and secondary accent preferences", async () => {
    const { loadPreferences } = await import("./preferences/storage");
    vi.mocked(loadPreferences).mockResolvedValueOnce({
      appearance: {
        themeMode: "light",
        lightTheme: "catppuccin-latte",
        darkTheme: "catppuccin-macchiato",
        accents: { primary: "lavender", secondary: "teal" },
        themeFeatures: { catppuccin: { accent: "lavender" } },
        uiFont: "Inter Variable",
        monoFont: "Fira Code",
      },
    });

    render(<App />);

    await waitFor(() => expect(document.documentElement.dataset.primaryAccent).toBe("lavender"));
    expect(document.documentElement.dataset.secondaryAccent).toBe("teal");
  });
});

describe("App / showcase shortcut", () => {
  it("mounts the showcase when ⌘+Shift+D is pressed", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "d", metaKey: true, shiftKey: true });
    expect(screen.getByRole("heading", { name: "Design system showcase" })).toBeInTheDocument();
  });
});

describe("App / Jira issues navigation", () => {
  it("renders Jira issues nav item in the sidebar", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /jira issues/i })).toBeInTheDocument();
  });

  it("navigates to Jira issues page when nav item is clicked", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /jira issues/i }));
    expect(screen.getByText(/no jira issues yet/i)).toBeInTheDocument();
  });

  it("Inbox nav item is active by default", () => {
    render(<App />);
    const inboxButtons = screen.getAllByRole("button", { name: /inbox/i });
    const inboxNav = inboxButtons.find((b) => b.textContent?.toLowerCase().includes("inbox") && !b.textContent?.toLowerCase().includes("jira"));
    expect(inboxNav).toHaveAttribute("aria-current", "page");
  });

  it("Jira issues nav item becomes active after navigation", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /jira issues/i }));
    expect(screen.getByRole("button", { name: /jira issues/i })).toHaveAttribute("aria-current", "page");
  });
});

describe("App / Backlog hygiene navigation", () => {
  it("renders Backlog hygiene nav item in the sidebar", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /backlog hygiene/i })).toBeInTheDocument();
  });

  it("navigates to Backlog hygiene page when nav item is clicked", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /backlog hygiene/i }));
    expect(await screen.findByRole("button", { name: "All" })).toBeInTheDocument();
  });

  it("Backlog hygiene nav item becomes active after navigation", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /backlog hygiene/i }));
    expect(screen.getByRole("button", { name: /backlog hygiene/i })).toHaveAttribute("aria-current", "page");
  });
});

describe("App / quick switcher", () => {
  const issue = {
    work_item_id: "wi-1087",
    key: "AMP-1087",
    title: "Cardinality mismatch",
    status_name: "Open",
    assignee_display_name: "Elena",
    updated_at_source: null,
    project_key: "AMP",
    priority_name: "P3",
    labels: ["sync"],
  };

  beforeEach(() => {
    mockUseJiraIssues.mockReturnValue({ issues: [issue], loading: false, error: null });
  });

  it("opens the quick switcher with ⌘K and closes it when ⌘K is pressed again", async () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByRole("dialog", { name: "Quick switcher" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Quick switcher" })).not.toBeInTheDocument(),
    );
  });

  it("opens the quick switcher from the sidebar Search button", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Search items" }));
    expect(screen.getByRole("dialog", { name: "Quick switcher" })).toBeInTheDocument();
  });

  it("quick switcher shortcut does not break the showcase shortcut", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "d", metaKey: true, shiftKey: true });
    expect(screen.getByRole("heading", { name: "Design system showcase" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByRole("dialog", { name: "Quick switcher" })).toBeInTheDocument();
  });

  it("opens a Jira result into the Jira collection surface", async () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    await userEvent.type(
      screen.getByRole("combobox", { name: "Search items" }),
      "1087",
    );
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Search items" }), { key: "Enter" });

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Quick switcher" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /Jira issues/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: /Open AMP-1087/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("heading", { name: "Cardinality mismatch" })).toBeInTheDocument();
  });
});
