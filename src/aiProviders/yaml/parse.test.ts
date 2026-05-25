import { describe, it, expect } from "vitest";
import { yamlToConfig, YamlParseError } from "./parse";
import { configToYaml } from "./serialize";
import type { AiProviderConfig } from "../types";

const PREVIOUS: AiProviderConfig = {
  version: 1,
  credentials: [],
  endpoints: [],
  profiles: [],
  routing: {},
};

const AUTOCATALYST_FRAGMENT = `credentials:
  - name: grove
    type: api_key
    value: \${KEYCHAIN:ai.credentials.grove}
endpoints:
  - name: grove-anthropic
    protocol: anthropic
    base_url: https://example.com/anthropic
    credential: grove
profiles:
  - name: grove-sonnet
    endpoint: grove-anthropic
    model: claude-sonnet-4-6
    runner: claude_agent_sdk
    anthropic:
      effort: medium
      thinking: adaptive
routing:
  question.answer: grove-sonnet
`;

describe("yamlToConfig", () => {
  it("parses the autocatalyst-shaped fragment", () => {
    const cfg = yamlToConfig(AUTOCATALYST_FRAGMENT, PREVIOUS);
    expect(cfg.credentials).toHaveLength(1);
    expect(cfg.credentials[0].source).toEqual({
      type: "Keychain",
      key_ref: "ai.credentials.grove",
    });
    expect(cfg.endpoints[0].protocol).toBe("AnthropicMessages");
    expect(cfg.profiles[0].runner).toBe("AnthropicMessages");
    expect(cfg.profiles[0].settings).toMatchObject({
      effort: "medium",
      thinking: "adaptive",
      _yaml_runner: "claude_agent_sdk",
    });
    expect(cfg.routing["question.answer"]).toBe("grove-sonnet");
  });

  it("rejects YAML that references a missing endpoint", () => {
    const bad = AUTOCATALYST_FRAGMENT.replace("endpoint: grove-anthropic", "endpoint: missing");
    expect(() => yamlToConfig(bad, PREVIOUS)).toThrow(YamlParseError);
  });

  it("rejects routing that references a missing profile", () => {
    const bad = AUTOCATALYST_FRAGMENT.replace("question.answer: grove-sonnet", "question.answer: missing");
    expect(() => yamlToConfig(bad, PREVIOUS)).toThrow(/no profile named "missing"/);
  });

  it("round-trips through configToYaml without losing information", () => {
    const once = yamlToConfig(AUTOCATALYST_FRAGMENT, PREVIOUS);
    const round = yamlToConfig(configToYaml(once), PREVIOUS);
    expect(round).toEqual(once);
  });

  it("refuses plaintext secret values", () => {
    const bad = AUTOCATALYST_FRAGMENT.replace(
      "value: ${KEYCHAIN:ai.credentials.grove}",
      "value: sk-plaintext-secret",
    );
    expect(() => yamlToConfig(bad, PREVIOUS)).toThrow(/sigil/);
  });
});
