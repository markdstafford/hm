import YAML from "yaml";
import type {
  AiCredentialConfig,
  AiCredentialKind,
  AiEndpointConfig,
  AiEndpointProtocol,
  AiProfileConfig,
  AiProviderConfig,
  AiRunner,
} from "../types";

export class YamlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YamlParseError";
  }
}

function asString(v: unknown, key: string): string {
  if (typeof v !== "string") throw new YamlParseError(`Expected ${key} to be a string`);
  return v;
}

function asArray(v: unknown, key: string): unknown[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new YamlParseError(`Expected ${key} to be a list`);
  return v;
}

function parseCredential(raw: unknown, i: number): AiCredentialConfig {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const where = `credentials[${i}]`;
  const name = asString(obj.name, `${where}.name`);
  const type = asString(obj.type, `${where}.type`);

  if (type === "iam") {
    const awsProfile = asString(obj.aws_profile, `${where}.aws_profile`);
    return {
      name,
      kind: "AwsIamProfile",
      source: { type: "Env", var_name: awsProfile },
    };
  }
  if (type === "api_key" || type === "bearer_token") {
    const kind: AiCredentialKind = type === "api_key" ? "ApiKey" : "BearerToken";
    const value = obj.value as string | undefined;
    if (!value) {
      return { name, kind, source: { type: "Keychain", key_ref: `ai.credentials.${name}` } };
    }
    if (value.startsWith("${KEYCHAIN:") && value.endsWith("}")) {
      return {
        name,
        kind,
        source: { type: "Keychain", key_ref: value.slice("${KEYCHAIN:".length, -1) },
      };
    }
    if (value.startsWith("${") && value.endsWith("}")) {
      return { name, kind, source: { type: "Env", var_name: value.slice(2, -1) } };
    }
    throw new YamlParseError(
      `${where}.value: expected $\{ENV_VAR\} or $\{KEYCHAIN:key_ref\} sigil — never plaintext`,
    );
  }
  throw new YamlParseError(`${where}.type: unknown credential type "${type}"`);
}

function parseEndpoint(raw: unknown, i: number): AiEndpointConfig {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const where = `endpoints[${i}]`;
  const name = asString(obj.name, `${where}.name`);
  const protocol = asString(obj.protocol, `${where}.protocol`);
  const baseUrl = asString(obj.base_url, `${where}.base_url`);
  const credentialRef = asString(obj.credential, `${where}.credential`);

  let mappedProtocol: AiEndpointProtocol;
  if (protocol === "anthropic" || protocol === "AnthropicMessages") {
    mappedProtocol = "AnthropicMessages";
  } else if (protocol === "openai" || protocol === "OpenAiChatCompletionsCompatible") {
    mappedProtocol = "OpenAiChatCompletionsCompatible";
  } else {
    throw new YamlParseError(`${where}.protocol: unknown protocol "${protocol}"`);
  }
  return { name, protocol: mappedProtocol, base_url: baseUrl, credential_ref: credentialRef };
}

function parseProfile(raw: unknown, i: number): AiProfileConfig {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const where = `profiles[${i}]`;
  const name = asString(obj.name, `${where}.name`);
  const endpoint = asString(obj.endpoint, `${where}.endpoint`);
  const model = asString(obj.model, `${where}.model`);
  const runner = asString(obj.runner, `${where}.runner`);

  let mappedRunner: AiRunner;
  if (runner === "anthropic_direct" || runner === "claude_agent_sdk" || runner === "AnthropicMessages") {
    mappedRunner = "AnthropicMessages";
  } else if (runner === "openai_direct" || runner === "openai_agent_sdk" || runner === "OpenAiChatCompletions") {
    mappedRunner = "OpenAiChatCompletions";
  } else {
    throw new YamlParseError(`${where}.runner: unknown runner "${runner}"`);
  }

  const settings: Record<string, unknown> = { _yaml_runner: runner };
  if (obj.anthropic && typeof obj.anthropic === "object") {
    for (const [k, v] of Object.entries(obj.anthropic as Record<string, unknown>)) settings[k] = v;
  }
  if (obj.openai && typeof obj.openai === "object") {
    for (const [k, v] of Object.entries(obj.openai as Record<string, unknown>)) settings[k] = v;
  }
  const known = new Set(["name", "endpoint", "model", "runner", "anthropic", "openai"]);
  for (const [k, v] of Object.entries(obj)) {
    if (!known.has(k)) settings[k] = v;
  }
  return {
    name,
    endpoint_ref: endpoint,
    model,
    runner: mappedRunner,
    execution_mode: "DirectApi",
    settings,
  };
}

export function yamlToConfig(yaml: string, previous: AiProviderConfig): AiProviderConfig {
  let parsed: unknown;
  try {
    parsed = YAML.parse(yaml);
  } catch (e) {
    throw new YamlParseError(`YAML parse error: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new YamlParseError("YAML root must be a mapping");
  }
  const obj = parsed as Record<string, unknown>;
  const credentials = asArray(obj.credentials, "credentials").map(parseCredential);
  const endpoints = asArray(obj.endpoints, "endpoints").map(parseEndpoint);
  const profiles = asArray(obj.profiles, "profiles").map(parseProfile);
  const routing: Record<string, string> = {};
  if (obj.routing && typeof obj.routing === "object") {
    for (const [task, profileName] of Object.entries(obj.routing as Record<string, unknown>)) {
      if (typeof profileName !== "string") {
        throw new YamlParseError(`routing[${task}]: expected a profile name string`);
      }
      routing[task] = profileName;
    }
  }
  const credNames = new Set(credentials.map((c) => c.name));
  for (const e of endpoints) {
    if (!credNames.has(e.credential_ref)) {
      throw new YamlParseError(`endpoints[${e.name}].credential: no credential named "${e.credential_ref}"`);
    }
  }
  const endpointNames = new Set(endpoints.map((e) => e.name));
  for (const p of profiles) {
    if (!endpointNames.has(p.endpoint_ref)) {
      throw new YamlParseError(`profiles[${p.name}].endpoint: no endpoint named "${p.endpoint_ref}"`);
    }
  }
  const profileNames = new Set(profiles.map((p) => p.name));
  for (const [task, profileName] of Object.entries(routing)) {
    if (!profileNames.has(profileName)) {
      throw new YamlParseError(`routing[${task}]: no profile named "${profileName}"`);
    }
  }
  return {
    version: previous.version,
    credentials,
    endpoints,
    profiles,
    routing,
  };
}
