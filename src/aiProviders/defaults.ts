import type { AiProviderConfig } from "./types";

export const EMPTY_AI_PROVIDER_CONFIG: AiProviderConfig = {
  version: 1,
  credentials: [],
  endpoints: [],
  profiles: [],
  routing: {},
};

export const RUNNER_LABELS: Record<string, string> = {
  AnthropicMessages: "Anthropic Messages (direct API)",
  OpenAiChatCompletions: "OpenAI-compatible Chat Completions (direct API)",
  OpenAiEmbeddings: "OpenAI-compatible Embeddings (direct API)",
};

export const EMPTY_STATES = {
  credentials: "Add a credential before creating endpoints. Secrets are stored in the OS keychain or read from environment variables.",
  endpoints: "Add an endpoint that points to an approved provider or gateway.",
  profiles: "Create a profile by choosing an endpoint, model, execution mode, and runner. DirectApi profiles support Anthropic Messages, OpenAI-compatible Chat Completions, and OpenAI-compatible Embeddings.",
  routing: "Route AI tasks to profiles. Embedding refresh uses embedding.default.",
} as const;
