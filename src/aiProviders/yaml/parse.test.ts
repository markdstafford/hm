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

  it("refuses empty ${KEYCHAIN:} sigils", () => {
    const bad = AUTOCATALYST_FRAGMENT.replace(
      "value: ${KEYCHAIN:ai.credentials.grove}",
      "value: ${KEYCHAIN:}",
    );
    expect(() => yamlToConfig(bad, PREVIOUS)).toThrow(/empty \$\{KEYCHAIN/);
  });

  it("refuses empty ${} env sigils", () => {
    const bad = AUTOCATALYST_FRAGMENT.replace(
      "value: ${KEYCHAIN:ai.credentials.grove}",
      "value: ${}",
    );
    expect(() => yamlToConfig(bad, PREVIOUS)).toThrow(/empty \$\{/);
  });

  it("refuses non-string value fields", () => {
    const bad = AUTOCATALYST_FRAGMENT.replace(
      "value: ${KEYCHAIN:ai.credentials.grove}",
      "value: 42",
    );
    expect(() => yamlToConfig(bad, PREVIOUS)).toThrow(/expected a string sigil/);
  });

  it("accepts the autocatalyst.yaml-style ai: wrapper", () => {
    const wrapped = "ai:\n" + AUTOCATALYST_FRAGMENT
      .split("\n")
      .map((line) => (line.length > 0 ? "  " + line : line))
      .join("\n");
    const cfg = yamlToConfig(wrapped, PREVIOUS);
    expect(cfg.profiles[0].name).toBe("grove-sonnet");
    expect(cfg.routing["question.answer"]).toBe("grove-sonnet");
  });

  it("rejects YAML with no recognized keys to avoid silently wiping config", () => {
    // An empty mapping previously parsed as an empty config because every
    // optional array defaulted to []. Pasting the wrong file would then
    // overwrite the saved AI providers with nothing.
    expect(() => yamlToConfig("{}\n", PREVIOUS)).toThrow(/at least one of credentials/);
    expect(() => yamlToConfig("name: something\n", PREVIOUS)).toThrow(/at least one of credentials/);
    // An `ai:` whose value is a scalar (not a mapping) also fails the wrap test.
    expect(() => yamlToConfig("ai: nope\n", PREVIOUS)).toThrow(/at least one of credentials/);
  });

  it("rejects secret-shaped keys in profile settings", () => {
    const bad = `credentials:
  - name: k
    type: api_key
    value: \${KEYCHAIN:ai.credentials.k}
endpoints:
  - name: e
    protocol: openai
    base_url: https://api.openai.com/v1
    credential: k
profiles:
  - name: p
    endpoint: e
    model: gpt-x
    runner: openai_direct
    openai:
      api_key: sk-snuck-in
`;
    expect(() => yamlToConfig(bad, PREVIOUS)).toThrow(/api_key|secret/i);
  });

  it("rejects secret-shaped keys nested inside an array in profile settings", () => {
    // The Rust validator walks arrays. Without array recursion in TS the
    // parser previously accepted this YAML and the plaintext key would
    // only get caught at backend save time.
    const bad = `credentials:
  - name: k
    type: api_key
    value: \${KEYCHAIN:ai.credentials.k}
endpoints:
  - name: e
    protocol: openai
    base_url: https://api.openai.com/v1
    credential: k
profiles:
  - name: p
    endpoint: e
    model: gpt-x
    runner: openai_direct
    extras:
      - harmless: ok
      - api_key: sk-via-array
`;
    expect(() => yamlToConfig(bad, PREVIOUS)).toThrow(/api_key|secret/i);
  });

  it("does not unwrap when the root already has known keys", () => {
    // Pathological mix: top-level routing and a stray ai: key. We must read
    // the top-level routing and not the inner ai.routing — otherwise users
    // could be tricked into silently saving the wrong scope.
    const mixed = `${AUTOCATALYST_FRAGMENT}
ai:
  routing:
    intent.classify: grove-sonnet
`;
    const cfg = yamlToConfig(mixed, PREVIOUS);
    expect(cfg.routing).toEqual({ "question.answer": "grove-sonnet" });
  });
});
