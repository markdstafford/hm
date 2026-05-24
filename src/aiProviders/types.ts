import type {
  AiProviderConfig as BindingAiProviderConfig,
  AiCredentialConfig,
  AiCredentialKind,
  AiEndpointConfig,
  AiEndpointProtocol,
  AiProfileConfig,
  AiRunner,
  AiExecutionMode,
  CredentialSource,
  SmokeTestResult,
  SmokeTestStatus,
} from "../bindings";

export type {
  AiCredentialConfig,
  AiCredentialKind,
  AiEndpointConfig,
  AiEndpointProtocol,
  AiProfileConfig,
  AiRunner,
  AiExecutionMode,
  CredentialSource,
  SmokeTestResult,
  SmokeTestStatus,
};
export type AiProviderConfig = BindingAiProviderConfig;
export type ValidationError = string;
export type AiSmokeTestResult = SmokeTestResult;
