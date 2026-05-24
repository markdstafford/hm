import { describe, expect, it } from "vitest";
import { EMPTY_AI_PROVIDER_CONFIG } from "./defaults";
import { validateAiProviderConfig } from "./validation";
import type { AiProviderConfig } from "./types";

function validConfig(): AiProviderConfig {
  return {
    version: 1,
    credentials: [
      {
        name: "openai-env",
        kind: "BearerToken",
        source: { type: "Env", var_name: "HM_TEST_OPENAI_COMPAT_KEY" },
      },
    ],
    endpoints: [
      {
        name: "gateway",
        protocol: "OpenAiChatCompletionsCompatible",
        base_url: "http://localhost:8080/v1",
        credential_ref: "openai-env",
      },
    ],
    profiles: [
      {
        name: "chat-fast",
        endpoint_ref: "gateway",
        model: "gpt-test",
        runner: "OpenAiChatCompletions",
        execution_mode: "DirectApi",
        settings: {},
      },
    ],
    routing: { "chat.answer": "chat-fast" },
  };
}

describe("validateAiProviderConfig", () => {
  it("accepts empty default config", () => {
    expect(validateAiProviderConfig(EMPTY_AI_PROVIDER_CONFIG)).toEqual([]);
  });

  it("accepts valid populated config", () => {
    expect(validateAiProviderConfig(validConfig())).toEqual([]);
  });

  it("rejects duplicate credential names", () => {
    const c = validConfig();
    c.credentials.push({ ...c.credentials[0] });
    expect(validateAiProviderConfig(c)).toContain("Duplicate credential name: openai-env");
  });

  it("rejects duplicate endpoint names", () => {
    const c = validConfig();
    c.endpoints.push({ ...c.endpoints[0] });
    expect(validateAiProviderConfig(c)).toContain("Duplicate endpoint name: gateway");
  });

  it("rejects invalid endpoint URL", () => {
    const c = validConfig();
    c.endpoints[0].base_url = "file:///tmp/model";
    const errors = validateAiProviderConfig(c);
    expect(errors).toContain("Invalid endpoint URL: gateway");
  });

  it("rejects missing credential reference in endpoint", () => {
    const c = validConfig();
    c.endpoints[0].credential_ref = "nonexistent";
    const errors = validateAiProviderConfig(c);
    expect(errors).toContain("Missing credential reference: nonexistent");
  });

  it("rejects missing endpoint reference in profile", () => {
    const c = validConfig();
    c.profiles[0].endpoint_ref = "nonexistent";
    const errors = validateAiProviderConfig(c);
    expect(errors).toContain("Missing endpoint reference: nonexistent");
  });

  it("rejects unsupported protocol/runner/execution-mode combo", () => {
    const c = validConfig();
    c.profiles[0].runner = "AnthropicMessages";
    const errors = validateAiProviderConfig(c);
    expect(errors).toContain("Unsupported protocol/runner/execution-mode combination: chat-fast");
  });

  it("rejects invalid task name (no dot)", () => {
    const c = validConfig();
    delete c.routing["chat.answer"];
    c.routing["issue"] = "chat-fast";
    const errors = validateAiProviderConfig(c);
    expect(errors).toContain("Invalid task name: issue");
  });

  it("rejects missing profile reference in routing", () => {
    const c = validConfig();
    c.routing["chat.answer"] = "missing-profile";
    const errors = validateAiProviderConfig(c);
    expect(errors).toContain("Missing profile reference: missing-profile");
  });

  it("rejects secret-shaped settings key api_key", () => {
    const c = validConfig();
    c.profiles[0].settings = { api_key: "sk-test-value" };
    const errors = validateAiProviderConfig(c);
    const errStr = errors.join("\n");
    expect(errStr).toContain("Secret-shaped settings key: api_key");
    expect(errStr).not.toContain("sk-test-value");
  });

  it("rejects secret-shaped settings key token", () => {
    const c = validConfig();
    c.profiles[0].settings = { access_token: "some-value" };
    const errors = validateAiProviderConfig(c);
    expect(errors.join("\n")).toContain("Secret-shaped settings key: access_token");
  });

  it("rejects invalid name with space", () => {
    const c = validConfig();
    c.credentials[0].name = "bad name";
    const errors = validateAiProviderConfig(c);
    expect(errors.join("\n")).toContain("Invalid credential name: bad name");
  });
});
