import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { SettingsPage } from "./SettingsPage";
import { DEFAULT_PREFERENCES } from "../../preferences";

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).PointerEvent = window.MouseEvent;
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__TAURI_INTERNALS__ = {};
});

vi.mock("../../bindings", () => ({
  commands: {
    sourceConfigGet: vi.fn().mockResolvedValue({ status: "ok", data: { version: 1, sources: [] } }),
    sourceConfigSave: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    sourceCredentialSecretSet: vi.fn().mockResolvedValue({ status: "ok", data: "k" }),
    sourceCredentialDelete: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    sourceConfigRemove: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    jiraSourceTestConnection: vi.fn().mockResolvedValue({
      status: "ok",
      data: { status: "Unavailable", tested_at: "2024-01-01T00:00:00Z", message: "x", suggested_fix: null, projects: [], category: "Unavailable" },
    }),
    aiProviderConfigGet: vi.fn().mockResolvedValue({
      status: "ok",
      data: { version: 1, credentials: [], endpoints: [], profiles: [], routing: {} },
    }),
    aiProviderConfigSave: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    aiCredentialSecretSet: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    aiCredentialSecretDelete: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    aiProfileSmokeTest: vi.fn().mockResolvedValue({
      status: "ok",
      data: { status: "Success", profile: "p", runner: "AnthropicMessages", execution_mode: "DirectApi", model: "m", elapsed_ms: 0, preview: null, error: null, suggested_fix: null },
    }),
  },
}));

describe("SettingsPage", () => {
  it("renders the General category by default", () => {
    render(
      <SettingsPage
        category="general"
        onPickCategory={() => {}}
        prefs={DEFAULT_PREFERENCES}
        onUpdatePreferences={vi.fn()}
        prefersDark={false}
      />,
    );
    expect(screen.getByRole("heading", { name: "General" })).toBeInTheDocument();
  });

  it("renders the Appearance category when picked", () => {
    render(
      <SettingsPage
        category="appearance"
        onPickCategory={() => {}}
        prefs={DEFAULT_PREFERENCES}
        onUpdatePreferences={vi.fn()}
        prefersDark={false}
      />,
    );
    expect(screen.getByRole("heading", { name: "Appearance" })).toBeInTheDocument();
  });
});
