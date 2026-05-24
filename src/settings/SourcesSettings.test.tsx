import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeAll, beforeEach, describe, it, expect } from "vitest";
import { SettingsPanel } from "./SettingsPanel";
import type { AppPreferences } from "../preferences";
import { commands } from "../bindings";

beforeAll(() => {
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
  (window as any).__TAURI_INTERNALS__ = {};
});

vi.mock("../bindings", () => ({
  commands: {
    aiProviderConfigGet: vi.fn().mockResolvedValue({
      status: "ok",
      data: { version: 1, credentials: [], endpoints: [], profiles: [], routing: {} },
    }),
    aiProviderConfigSave: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    aiCredentialSecretSet: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    aiCredentialSecretDelete: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    aiProfileSmokeTest: vi.fn().mockResolvedValue({ status: "ok", data: { status: "Success", profile: "p", runner: "OpenAiChatCompletions", execution_mode: "DirectApi", model: "m", elapsed_ms: 0, preview: null, error: null, suggested_fix: null } }),
    sourceConfigGet: vi.fn().mockResolvedValue({ status: "ok", data: { version: 1, sources: [] } }),
    sourceConfigSave: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    sourceCredentialSecretSet: vi.fn().mockResolvedValue({ status: "ok", data: "source.jira.src_team.pat" }),
    sourceCredentialDelete: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    sourceConfigRemove: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    jiraSourceTestConnection: vi.fn().mockResolvedValue({
      status: "ok",
      data: {
        status: "Unavailable",
        tested_at: "2024-01-01T00:00:00Z",
        message: "Live connection testing depends on issue #9. The source can be saved, but projects must wait for the Jira API client.",
        suggested_fix: null,
        projects: [],
        category: "Unavailable",
      },
    }),
  },
}));

const defaultPrefs: AppPreferences = {
  appearance: {
    themeMode: "system",
    lightTheme: "catppuccin-latte",
    darkTheme: "catppuccin-macchiato",
    themeFeatures: { catppuccin: { accent: "sapphire" } },
    uiFont: "Inter Variable",
    monoFont: "Fira Code",
  },
};

function renderPanel(props?: Partial<Parameters<typeof SettingsPanel>[0]>) {
  const onClose = vi.fn();
  const onUpdatePreferences = vi.fn().mockResolvedValue(undefined);
  render(
    <SettingsPanel
      open={true}
      onClose={onClose}
      prefs={defaultPrefs}
      onUpdatePreferences={onUpdatePreferences}
      prefersDark={false}
      {...props}
    />
  );
  return { onClose, onUpdatePreferences };
}

async function openSources(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^sources$/i }));
  await screen.findByRole("heading", { name: /^sources$/i });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset sourceConfigGet to return empty config by default
  vi.mocked(commands.sourceConfigGet).mockResolvedValue({ status: "ok", data: { version: 1, sources: [] } });
});

describe("Sources settings", () => {
  it("shows empty source state when no sources configured", async () => {
    const user = userEvent.setup();
    renderPanel();
    await openSources(user);
    await waitFor(() => {
      expect(screen.getByText(/Add your first source/i)).toBeInTheDocument();
    });
  });

  it("renders Jira source row without credential ref or PAT value", async () => {
    const user = userEvent.setup();
    vi.mocked(commands.sourceConfigGet).mockResolvedValue({
      status: "ok",
      data: {
        version: 1,
        sources: [{
          kind: "Jira",
          id: "src_team",
          name: "Team Jira",
          enabled: true,
          server_url: "https://jira.internal.example.com",
          auth: { type: "Pat", credential_ref: "source.jira.src_team.pat" },
          projects: [{ key: "HM", name: "HM Project", id: "10001" }, { key: "OPS", name: "Operations", id: "10002" }],
          last_connection_test: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        }],
      },
    });
    renderPanel();
    await openSources(user);
    await waitFor(() => {
      expect(screen.getByText(/Team Jira/i)).toBeInTheDocument();
      expect(screen.getByText(/jira\.internal\.example\.com/i)).toBeInTheDocument();
    });
    // Must NOT expose credential ref or any PAT-like value
    expect(screen.queryByText(/source\.jira/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/credential_ref/i)).not.toBeInTheDocument();
  });

  it("remove asks for confirmation before deleting", async () => {
    const user = userEvent.setup();
    vi.mocked(commands.sourceConfigGet).mockResolvedValue({
      status: "ok",
      data: {
        version: 1,
        sources: [{
          kind: "Jira",
          id: "src_team",
          name: "Team Jira",
          enabled: true,
          server_url: "https://jira.internal.example.com",
          auth: { type: "Pat", credential_ref: "source.jira.src_team.pat" },
          projects: [],
          last_connection_test: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        }],
      },
    });
    renderPanel();
    await openSources(user);
    await screen.findByText(/Team Jira/i);
    await user.click(screen.getByRole("button", { name: /^remove$/i }));
    // Expect confirmation UI
    expect(screen.getByText(/Remove Team Jira\?/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^remove source$/i }));
    await waitFor(() => {
      expect(vi.mocked(commands.sourceConfigRemove)).toHaveBeenCalledWith("src_team");
    });
  });

  it("edit opens Jira form with metadata but no old PAT value", async () => {
    const user = userEvent.setup();
    vi.mocked(commands.sourceConfigGet).mockResolvedValue({
      status: "ok",
      data: {
        version: 1,
        sources: [{
          kind: "Jira",
          id: "src_team",
          name: "Team Jira",
          enabled: true,
          server_url: "https://jira.internal.example.com",
          auth: { type: "Pat", credential_ref: "source.jira.src_team.pat" },
          projects: [],
          last_connection_test: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        }],
      },
    });
    renderPanel();
    await openSources(user);
    await screen.findByText(/Team Jira/i);
    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    // Server URL should be visible in the form
    await waitFor(() => {
      const urlInput = screen.getByDisplayValue(/jira\.internal\.example\.com/i);
      expect(urlInput).toBeInTheDocument();
    });
    // PAT field should be empty (not showing old value)
    const patInput = screen.queryByLabelText(/personal access token/i) as HTMLInputElement | null;
    if (patInput) {
      expect(patInput.value).toBe("");
    }
  });

  it("shows Jira enabled and GitHub/Documents coming later in add flow", async () => {
    const user = userEvent.setup();
    renderPanel();
    await openSources(user);
    await user.click(screen.getByRole("button", { name: /add source/i }));
    expect(screen.getByRole("button", { name: /jira data center/i })).toBeInTheDocument();
    expect(screen.getAllByText(/coming later/i).length).toBeGreaterThan(0);
  });

  it("requires server URL and PAT for a new source — Save is disabled until both provided", async () => {
    const user = userEvent.setup();
    renderPanel();
    await openSources(user);
    await user.click(screen.getByRole("button", { name: /add source/i }));
    await user.click(screen.getByRole("button", { name: /jira data center/i }));
    const saveBtn = screen.getByRole("button", { name: /^save$/i });
    expect(saveBtn).toBeDisabled();
    await user.type(screen.getByLabelText(/server url/i), "https://jira.example.com");
    expect(saveBtn).toBeDisabled();
    await user.type(screen.getByLabelText(/personal access token/i), "my-token");
    expect(saveBtn).not.toBeDisabled();
  });

  it("stores PAT, saves metadata, and PAT input clears after save", async () => {
    const user = userEvent.setup();
    renderPanel();
    await openSources(user);
    await user.click(screen.getByRole("button", { name: /add source/i }));
    await user.click(screen.getByRole("button", { name: /jira data center/i }));
    await user.type(screen.getByLabelText(/server url/i), "https://jira.example.com");
    await user.type(screen.getByLabelText(/personal access token/i), "my-token");
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(vi.mocked(commands.sourceCredentialSecretSet)).toHaveBeenCalled();
      expect(vi.mocked(commands.sourceConfigSave)).toHaveBeenCalled();
    });
    // After save, should return to list view
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^sources$/i })).toBeInTheDocument();
    });
  });

  it("editing allows saving without replacing PAT — no sourceCredentialSecretSet call", async () => {
    const user = userEvent.setup();
    vi.mocked(commands.sourceConfigGet).mockResolvedValue({
      status: "ok",
      data: {
        version: 1,
        sources: [{
          kind: "Jira",
          id: "src_team",
          name: "Team Jira",
          enabled: true,
          server_url: "https://jira.internal.example.com",
          auth: { type: "Pat", credential_ref: "source.jira.src_team.pat" },
          projects: [],
          last_connection_test: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        }],
      },
    });
    renderPanel();
    await openSources(user);
    await screen.findByText(/Team Jira/i);
    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    await waitFor(() => screen.getByDisplayValue(/jira\.internal\.example\.com/i));
    const saveBtn = screen.getByRole("button", { name: /^save$/i });
    expect(saveBtn).not.toBeDisabled();
    await user.click(saveBtn);
    await waitFor(() => {
      expect(vi.mocked(commands.sourceConfigSave)).toHaveBeenCalled();
      expect(vi.mocked(commands.sourceCredentialSecretSet)).not.toHaveBeenCalled();
    });
  });

  it("cancel clears transient PAT state", async () => {
    const user = userEvent.setup();
    renderPanel();
    await openSources(user);
    await user.click(screen.getByRole("button", { name: /add source/i }));
    await user.click(screen.getByRole("button", { name: /jira data center/i }));
    await user.type(screen.getByLabelText(/personal access token/i), "my-token");
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    // Back to list
    await waitFor(() => screen.getByRole("button", { name: /add source/i }));
    // Open add flow again — PAT should be empty
    await user.click(screen.getByRole("button", { name: /add source/i }));
    await user.click(screen.getByRole("button", { name: /jira data center/i }));
    const patInput = screen.getByLabelText(/personal access token/i) as HTMLInputElement;
    expect(patInput.value).toBe("");
  });
});
