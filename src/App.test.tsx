import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { beforeAll, vi } from "vitest";
import App from "./App";

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
  },
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
