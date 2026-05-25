import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { AiProvidersCategory } from "./AiProvidersCategory";

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
    aiProviderConfigGet: vi.fn().mockResolvedValue({
      status: "ok",
      data: { version: 1, credentials: [], endpoints: [], profiles: [], routing: {} },
    }),
    aiProviderConfigSave: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    aiCredentialSecretSet: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    aiCredentialSecretDelete: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    aiProfileSmokeTest: vi.fn().mockResolvedValue({
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
    }),
  },
}));

describe("AiProvidersCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
