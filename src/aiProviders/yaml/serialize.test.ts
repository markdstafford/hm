import { describe, it, expect } from "vitest";
import { configToYaml } from "./serialize";
import type { AiProviderConfig } from "../types";

const SAMPLE: AiProviderConfig = {
  version: 1,
  credentials: [
    {
      name: "grove",
      kind: "ApiKey",
      source: { type: "Keychain", key_ref: "ai.credentials.grove" },
    },
  ],
  endpoints: [
    {
      name: "grove-anthropic",
      protocol: "AnthropicMessages",
      base_url: "https://example.com/anthropic",
      credential_ref: "grove",
    },
  ],
  profiles: [
    {
      name: "grove-sonnet",
      endpoint_ref: "grove-anthropic",
      model: "claude-sonnet-4-6",
      runner: "AnthropicMessages",
      execution_mode: "DirectApi",
      settings: { effort: "medium", thinking: "adaptive" },
    },
  ],
  routing: { "question.answer": "grove-sonnet" },
};

describe("configToYaml", () => {
  it("emits credentials with Keychain sigil for keychain-sourced secrets", () => {
    const yaml = configToYaml(SAMPLE);
    expect(yaml).toContain("name: grove");
    expect(yaml).toContain("type: api_key");
    expect(yaml).toContain("value: ${KEYCHAIN:ai.credentials.grove}");
  });

  it("emits the shortened protocol name for endpoints", () => {
    const yaml = configToYaml(SAMPLE);
    expect(yaml).toContain("protocol: anthropic");
  });

  it("groups anthropic-knob settings under the anthropic block", () => {
    const yaml = configToYaml(SAMPLE);
    expect(yaml).toMatch(/anthropic:\s+effort: medium\s+thinking: adaptive/);
  });

  it("emits routing as a top-level mapping", () => {
    const yaml = configToYaml(SAMPLE);
    expect(yaml).toMatch(/routing:\s+question\.answer: grove-sonnet/);
  });

  it("emits OpenAI embeddings protocol and runner aliases", () => {
    const config: AiProviderConfig = {
      version: 1,
      credentials: SAMPLE.credentials,
      endpoints: [
        {
          name: "grove-embeddings",
          protocol: "OpenAiEmbeddingsCompatible",
          base_url: "https://grove-gateway-prod.azure-api.net/grove-foundry-prod/openai/v1",
          credential_ref: "grove",
        },
      ],
      profiles: [
        {
          name: "grove-embed-v4",
          endpoint_ref: "grove-embeddings",
          model: "embed-v-4-0",
          runner: "OpenAiEmbeddings",
          execution_mode: "DirectApi",
          settings: {
            max_inputs_per_request: 96,
            max_estimated_tokens_per_request: 8000,
            max_batches_per_run: 50,
            rate_limit_backoff_seconds: 60,
          },
        },
      ],
      routing: { "embedding.default": "grove-embed-v4" },
    };
    const yaml = configToYaml(config);
    expect(yaml).toContain("protocol: openai_embeddings");
    expect(yaml).toContain("runner: openai_embeddings");
    expect(yaml).toContain("model: embed-v-4-0");
    expect(yaml).toMatch(/routing:\s+embedding\.default: grove-embed-v4/);
  });

  it("preserves the _yaml_runner hint when present", () => {
    const config: AiProviderConfig = {
      ...SAMPLE,
      profiles: [
        {
          ...SAMPLE.profiles[0],
          settings: {
            ...(SAMPLE.profiles[0].settings as Record<string, unknown>),
            _yaml_runner: "claude_agent_sdk",
          },
        },
      ],
    };
    const yaml = configToYaml(config);
    expect(yaml).toContain("runner: claude_agent_sdk");
  });
});
