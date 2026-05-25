import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { SourcesCategory } from "./SourcesCategory";

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
    sourceConfigGet: vi.fn().mockResolvedValue({ status: "ok", data: { version: 1, sources: [] } }),
    sourceConfigSave: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    sourceCredentialSecretSet: vi.fn().mockResolvedValue({ status: "ok", data: "source.jira.test.pat" }),
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
  },
}));

describe("SourcesCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
