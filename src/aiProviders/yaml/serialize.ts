import { Document } from "yaml";
import type {
  AiCredentialConfig,
  AiEndpointConfig,
  AiProfileConfig,
  AiProviderConfig,
} from "../types";

type YamlCredential =
  | { name: string; type: "iam"; aws_profile: string }
  | { name: string; type: "api_key" | "bearer_token"; value?: string };

type YamlEndpoint = {
  name: string;
  protocol: "anthropic" | "openai";
  base_url: string;
  credential: string;
};

type YamlProfile = {
  name: string;
  endpoint: string;
  model: string;
  runner: string;
  anthropic?: Record<string, unknown>;
  openai?: Record<string, unknown>;
  [key: string]: unknown;
};

const ANTHROPIC_KEYS = ["effort", "thinking"];
const OPENAI_KEYS = ["reasoning_effort"];

function credentialToYaml(c: AiCredentialConfig): YamlCredential {
  if (c.kind === "AwsIamProfile") {
    const awsProfile = c.source.type === "Env" ? c.source.var_name : c.source.key_ref;
    return { name: c.name, type: "iam", aws_profile: awsProfile };
  }
  const yamlType = c.kind === "BearerToken" ? "bearer_token" : "api_key";
  if (c.source.type === "Env") {
    return { name: c.name, type: yamlType, value: "${" + c.source.var_name + "}" };
  }
  return { name: c.name, type: yamlType, value: "${KEYCHAIN:" + c.source.key_ref + "}" };
}

function endpointToYaml(e: AiEndpointConfig): YamlEndpoint {
  const protocol = e.protocol === "AnthropicMessages" ? "anthropic" : "openai";
  return {
    name: e.name,
    protocol,
    base_url: e.base_url,
    credential: e.credential_ref,
  };
}

function profileToYaml(p: AiProfileConfig): YamlProfile {
  const settings = { ...((p.settings as Record<string, unknown>) ?? {}) };
  const yamlRunner =
    (settings._yaml_runner as string | undefined) ??
    (p.runner === "AnthropicMessages" ? "anthropic_direct" : "openai_direct");
  delete settings._yaml_runner;

  const out: YamlProfile = {
    name: p.name,
    endpoint: p.endpoint_ref,
    model: p.model,
    runner: yamlRunner,
  };
  const anthropicBlock: Record<string, unknown> = {};
  const openaiBlock: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(settings)) {
    if (ANTHROPIC_KEYS.includes(k)) anthropicBlock[k] = v;
    else if (OPENAI_KEYS.includes(k)) openaiBlock[k] = v;
    else out[k] = v;
  }
  if (Object.keys(anthropicBlock).length) out.anthropic = anthropicBlock;
  if (Object.keys(openaiBlock).length) out.openai = openaiBlock;
  return out;
}

export function configToYaml(config: AiProviderConfig): string {
  const doc = new Document({
    credentials: config.credentials.map(credentialToYaml),
    endpoints: config.endpoints.map(endpointToYaml),
    profiles: config.profiles.map(profileToYaml),
    routing: config.routing,
  });
  return String(doc);
}
