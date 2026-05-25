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
    const next = onSave.mock.calls[0][0] as AiProviderConfig;
    expect(next.profiles).toHaveLength(2);
    expect(next.profiles[1].name).toBe("p2");
    expect(next.profiles[1].endpoint_ref).toBe("e");
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
    const next = onSave.mock.calls[0][0] as AiProviderConfig;
    expect(next.routing["question.answer"]).toBe("p-renamed");
  });
});
