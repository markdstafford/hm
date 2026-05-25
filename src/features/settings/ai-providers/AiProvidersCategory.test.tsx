import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { AiProvidersCategory } from "./AiProvidersCategory";
import { commands } from "../../../bindings";

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).PointerEvent = window.MouseEvent;
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__TAURI_INTERNALS__ = {};
});

vi.mock("../../../bindings", () => ({
  commands: {
    aiProviderConfigGet: vi.fn(),
    aiProviderConfigSave: vi.fn(),
    aiCredentialSecretSet: vi.fn(),
    aiCredentialSecretDelete: vi.fn(),
    aiProfileSmokeTest: vi.fn(),
  },
}));

// Reinstall the default mock implementations before every test. Using
// vi.resetAllMocks() instead of vi.clearAllMocks() means a per-test
// mockImplementation does not leak into the next test, so test ordering
// stays an implementation detail.
function installDefaults() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (commands.aiProviderConfigGet as any).mockResolvedValue({
    status: "ok",
    data: { version: 1, credentials: [], endpoints: [], profiles: [], routing: {} },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (commands.aiProviderConfigSave as any).mockResolvedValue({ status: "ok", data: null });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (commands.aiCredentialSecretSet as any).mockResolvedValue({ status: "ok", data: null });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (commands.aiCredentialSecretDelete as any).mockResolvedValue({ status: "ok", data: null });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (commands.aiProfileSmokeTest as any).mockResolvedValue({
    status: "ok",
    data: {
      status: "Success",
      profile: "test",
      runner: "AnthropicMessages",
      execution_mode: "DirectApi",
      model: "m",
      elapsed_ms: 100,
      preview: "ok",
      error: null,
      suggested_fix: null,
    },
  });
}

describe("AiProvidersCategory", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installDefaults();
  });

  it("renders the empty state when no profiles exist", async () => {
    render(<AiProvidersCategory />);
    expect(await screen.findByText(/No AI profiles configured/)).toBeInTheDocument();
  });

  it("switches between Form view and YAML view", async () => {
    render(<AiProvidersCategory />);
    await screen.findByText(/No AI profiles configured/);
    await userEvent.click(screen.getByRole("button", { name: /YAML view/ }));
    expect(await screen.findByRole("textbox", { name: /YAML/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Form view/ }));
    expect(await screen.findByText(/No AI profiles configured/)).toBeInTheDocument();
  });

  it("writes the keychain secret before saving the config when a new Keychain credential is created", async () => {
    // Push each call's identity into a shared call-order array. Previously
    // this test compared two independent counters that both ended at 1, so a
    // reversed order would still satisfy the assertion — a false positive.
    const callOrder: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (commands.aiCredentialSecretSet as any).mockImplementation(async () => {
      callOrder.push("set-secret");
      return { status: "ok", data: null };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (commands.aiProviderConfigSave as any).mockImplementation(async () => {
      callOrder.push("save-config");
      return { status: "ok", data: null };
    });

    render(<AiProvidersCategory />);
    await screen.findByText(/No AI profiles configured/);
    await userEvent.click(screen.getByRole("button", { name: /Add profile/ }));
    await userEvent.type(screen.getByLabelText(/Profile name/i), "freshie");
    await userEvent.type(screen.getByLabelText(/Endpoint name/i), "ep");
    await userEvent.type(screen.getByLabelText(/Credential name/i), "cred");
    await userEvent.type(screen.getByLabelText(/Secret value/i), "sk-keep-me");
    await userEvent.type(screen.getByLabelText(/^Model$/i), "claude-y");
    await userEvent.click(screen.getByRole("button", { name: /Add profile/ }));

    await waitFor(() => expect(callOrder).toContain("save-config"));
    expect(callOrder).toEqual(["set-secret", "save-config"]);
  });

  it("rolls back the keychain secret when the config save fails", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (commands.aiProviderConfigSave as any).mockResolvedValue({
      status: "error",
      error: "validation failed",
    });
    const deleteSpy = commands.aiCredentialSecretDelete as ReturnType<typeof vi.fn>;

    render(<AiProvidersCategory />);
    await screen.findByText(/No AI profiles configured/);
    await userEvent.click(screen.getByRole("button", { name: /Add profile/ }));
    await userEvent.type(screen.getByLabelText(/Profile name/i), "doomed");
    await userEvent.type(screen.getByLabelText(/Endpoint name/i), "ep");
    await userEvent.type(screen.getByLabelText(/Credential name/i), "doomed-cred");
    await userEvent.type(screen.getByLabelText(/Secret value/i), "sk-trash");
    await userEvent.type(screen.getByLabelText(/^Model$/i), "claude-y");
    await userEvent.click(screen.getByRole("button", { name: /Add profile/ }));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith("doomed-cred"));
    expect(await screen.findByText(/Save failed/)).toBeInTheDocument();
  });

  it("removes a profile and clears routing entries that pointed at it", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (commands.aiProviderConfigGet as any).mockResolvedValueOnce({
      status: "ok",
      data: {
        version: 1,
        credentials: [{ name: "k", kind: "ApiKey", source: { type: "Keychain", key_ref: "ai.credentials.k" } }],
        endpoints: [{ name: "e", protocol: "AnthropicMessages", base_url: "https://x", credential_ref: "k" }],
        profiles: [{ name: "victim", endpoint_ref: "e", model: "m", runner: "AnthropicMessages", execution_mode: "DirectApi", settings: {} }],
        routing: { "question.answer": "victim", "issue.triage": "victim" },
      },
    });
    const saveSpy = commands.aiProviderConfigSave as ReturnType<typeof vi.fn>;

    render(<AiProvidersCategory />);
    await screen.findByText("victim");
    await userEvent.click(screen.getByRole("button", { name: /Remove profile/ }));
    await userEvent.click(await screen.findByRole("button", { name: /^Remove profile$/ }));

    await waitFor(() => expect(saveSpy).toHaveBeenCalled());
    const savedConfig = saveSpy.mock.calls[0][0] as { profiles: unknown[]; routing: Record<string, string> };
    expect(savedConfig.profiles).toHaveLength(0);
    expect(savedConfig.routing).toEqual({});
  });
});
