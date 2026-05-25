import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { YamlAdvancedView } from "./YamlAdvancedView";
import type { AiProviderConfig } from "../../../aiProviders/types";

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
  routing: {},
};

describe("YamlAdvancedView", () => {
  it("populates the textarea with serialized config", () => {
    render(<YamlAdvancedView config={CONFIG} onSave={() => {}} onCancel={() => {}} />);
    const ta = screen.getByRole("textbox", { name: /YAML/i }) as HTMLTextAreaElement;
    expect(ta.value).toContain("name: k");
  });

  it("rejects YAML with a broken endpoint reference", async () => {
    render(<YamlAdvancedView config={CONFIG} onSave={() => {}} onCancel={() => {}} />);
    const ta = screen.getByRole("textbox", { name: /YAML/i }) as HTMLTextAreaElement;
    const bad =
      "credentials: []\nendpoints: []\nprofiles:\n  - name: p\n    endpoint: missing\n    model: m\n    runner: anthropic_direct\nrouting: {}\n";
    // Set value via the native setter so React's onChange fires.
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!;
    setter.call(ta, bad);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    await userEvent.click(screen.getByRole("button", { name: /Apply YAML/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/no endpoint named/i);
  });

  it("calls onSave with the parsed config on success", async () => {
    const onSave = vi.fn();
    render(<YamlAdvancedView config={CONFIG} onSave={onSave} onCancel={() => {}} />);
    const ta = screen.getByRole("textbox", { name: /YAML/i }) as HTMLTextAreaElement;
    // Append a trailing newline so the textarea is "dirty".
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!;
    setter.call(ta, ta.value + "\n");
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    await userEvent.click(screen.getByRole("button", { name: /Apply YAML/ }));
    expect(onSave).toHaveBeenCalledOnce();
  });
});
