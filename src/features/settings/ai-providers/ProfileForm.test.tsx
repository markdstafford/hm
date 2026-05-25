import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { ProfileForm } from "./ProfileForm";
import type { AiProviderConfig } from "../../../aiProviders/types";

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

const CONFIG: AiProviderConfig = {
  version: 1,
  credentials: [{
    name: "k",
    kind: "ApiKey",
    source: { type: "Keychain", key_ref: "ai.credentials.k" },
  }],
  endpoints: [{
    name: "e",
    protocol: "AnthropicMessages",
    base_url: "https://example.com",
    credential_ref: "k",
  }],
  profiles: [{
    name: "p",
    endpoint_ref: "e",
    model: "claude-x",
    runner: "AnthropicMessages",
    execution_mode: "DirectApi",
    settings: {},
  }],
  routing: { "question.answer": "p" },
};

describe("ProfileForm", () => {
  it("blocks save when required fields are missing", () => {
    const onSave = vi.fn();
    render(<ProfileForm mode="create" config={CONFIG} onCancel={() => {}} onSave={onSave} />);
    const save = screen.getByRole("button", { name: /Add profile/ });
    expect(save).toBeDisabled();
  });

  it("creates a new profile referencing an existing connection", async () => {
    const onSave = vi.fn();
    render(<ProfileForm mode="create" config={CONFIG} onCancel={() => {}} onSave={onSave} />);
    await userEvent.type(screen.getByLabelText(/Profile name/i), "p2");
    await userEvent.type(screen.getByLabelText(/^Model$/i), "claude-y");
    const save = screen.getByRole("button", { name: /Add profile/ });
    await userEvent.click(save);
    expect(onSave).toHaveBeenCalledOnce();
    const { next, pendingSecret } = onSave.mock.calls[0][0] as {
      next: AiProviderConfig;
      pendingSecret?: { credentialName: string; value: string };
    };
    expect(next.profiles).toHaveLength(2);
    expect(next.profiles[1].name).toBe("p2");
    expect(next.profiles[1].endpoint_ref).toBe("e");
    expect(pendingSecret).toBeUndefined();
  });

  it("cascades a rename through the routing map", async () => {
    const onSave = vi.fn();
    render(
      <ProfileForm
        mode="edit"
        config={CONFIG}
        initialProfileName="p"
        onCancel={() => {}}
        onSave={onSave}
      />,
    );
    const nameInput = screen.getByLabelText(/Profile name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "p-renamed");
    expect(await screen.findByText(/Renaming will cascade/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Save changes/ }));
    const { next } = onSave.mock.calls[0][0] as { next: AiProviderConfig };
    expect(next.routing["question.answer"]).toBe("p-renamed");
  });

  it("preserves unknown settings keys when editing a profile", async () => {
    const onSave = vi.fn();
    const configWithRichSettings: AiProviderConfig = {
      ...CONFIG,
      profiles: [
        {
          ...CONFIG.profiles[0],
          settings: {
            effort: "low",
            thinking: "adaptive",
            _yaml_runner: "claude_agent_sdk",
            beta_header_filter: { strip: ["advisor-tool-2026-03-01"] },
          },
        },
      ],
    };
    render(
      <ProfileForm
        mode="edit"
        config={configWithRichSettings}
        initialProfileName="p"
        onCancel={() => {}}
        onSave={onSave}
      />,
    );
    // Save without changing anything: the unknown keys must survive.
    await userEvent.click(screen.getByRole("button", { name: /Save changes/ }));
    const { next } = onSave.mock.calls[0][0] as { next: AiProviderConfig };
    const settings = next.profiles[0].settings as Record<string, unknown>;
    expect(settings.thinking).toBe("adaptive");
    expect(settings._yaml_runner).toBe("claude_agent_sdk");
    expect(settings.beta_header_filter).toEqual({ strip: ["advisor-tool-2026-03-01"] });
    expect(settings.effort).toBe("low");
  });

  it("blocks edit-mode save when 'create new credential' would collide with an existing name", async () => {
    // Edit mode previously skipped the duplicate-credential check, allowing
    // the form to enqueue a write that would overwrite the colliding
    // credential's secret. The check now runs regardless of mode.
    const onSave = vi.fn();
    render(
      <ProfileForm
        mode="edit"
        config={CONFIG}
        initialProfileName="p"
        onCancel={() => {}}
        onSave={onSave}
      />,
    );
    // Switch to "Create new connection" → "Create new credential" with the
    // existing credential name "k".
    await userEvent.click(screen.getByRole("radio", { name: /create new connection/i }));
    await userEvent.type(screen.getByLabelText(/Endpoint name/i), "another");
    await userEvent.click(screen.getByRole("radio", { name: /create new credential/i }));
    await userEvent.type(screen.getByLabelText(/Credential name/i), "k");
    await userEvent.type(screen.getByLabelText(/Secret value/i), "sk-attacker");
    const save = screen.getByRole("button", { name: /Save changes/ });
    expect(save).toBeDisabled();
    expect(screen.getByText(/A credential named "k" already exists/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("blocks edit-mode save when 'create new endpoint' would collide with an existing name", async () => {
    const onSave = vi.fn();
    render(
      <ProfileForm
        mode="edit"
        config={CONFIG}
        initialProfileName="p"
        onCancel={() => {}}
        onSave={onSave}
      />,
    );
    await userEvent.click(screen.getByRole("radio", { name: /create new connection/i }));
    // Re-use the existing endpoint name "e".
    await userEvent.type(screen.getByLabelText(/Endpoint name/i), "e");
    const save = screen.getByRole("button", { name: /Save changes/ });
    expect(save).toBeDisabled();
    expect(screen.getByText(/An endpoint named "e" already exists/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("produces a pendingSecret when creating a new Keychain credential", async () => {
    const onSave = vi.fn();
    const emptyConfig: AiProviderConfig = {
      version: 1,
      credentials: [],
      endpoints: [],
      profiles: [],
      routing: {},
    };
    render(<ProfileForm mode="create" config={emptyConfig} onCancel={() => {}} onSave={onSave} />);
    await userEvent.type(screen.getByLabelText(/Profile name/i), "fresh");
    await userEvent.type(screen.getByLabelText(/Endpoint name/i), "ep");
    await userEvent.type(screen.getByLabelText(/Credential name/i), "cred");
    await userEvent.type(screen.getByLabelText(/Secret value/i), "sk-secret");
    await userEvent.type(screen.getByLabelText(/^Model$/i), "claude-y");
    await userEvent.click(screen.getByRole("button", { name: /Add profile/ }));
    const { next, pendingSecret } = onSave.mock.calls[0][0] as {
      next: AiProviderConfig;
      pendingSecret?: { credentialName: string; value: string };
    };
    expect(pendingSecret).toEqual({ credentialName: "cred", value: "sk-secret" });
    expect(next.credentials).toHaveLength(1);
    expect(next.credentials[0].source).toEqual({
      type: "Keychain",
      key_ref: "ai.credentials.cred",
    });
  });
});
