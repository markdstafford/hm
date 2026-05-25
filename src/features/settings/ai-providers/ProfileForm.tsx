import { useMemo, useState } from "react";
import { AlertTriangle, FlaskConical } from "lucide-react";
import type {
  AiCredentialConfig,
  AiEndpointConfig,
  AiProfileConfig,
  AiProviderConfig,
  AiEndpointProtocol,
  AiRunner,
} from "../../../aiProviders/types";
import { Button } from "../../../ui/buttons/Button";
import { Field } from "../../../ui/forms/Field";
import { TextField } from "../../../ui/forms/TextField";
import { Select } from "../../../ui/forms/Select";
import { RadioGroup } from "../../../ui/forms/RadioGroup";
import { Checkbox } from "../../../ui/forms/Checkbox";
import { Form } from "../../../ui/forms/Form";

export const ROUTING_TASKS = [
  "intent.classify",
  "pr.title_generate",
  "artifact.create",
  "artifact.revise",
  "implementation.plan",
  "implementation.run",
  "implementation.review.initial",
  "implementation.review.final",
  "question.answer",
  "issue.triage",
] as const;

type Mode = "create" | "edit";
type ConnectionMode = "existing" | "new";
type CredentialMode = "existing" | "new";

export interface ProfileFormSavePayload {
  next: AiProviderConfig;
  /**
   * Present when the form created a new Keychain-sourced credential. The
   * orchestrator must write this secret to the OS keychain before persisting
   * the config so the credential reference resolves.
   */
  pendingSecret?: { credentialName: string; value: string };
}

interface ProfileFormProps {
  mode: Mode;
  config: AiProviderConfig;
  initialProfileName?: string;
  onTest?: () => Promise<{ status: "Success" | "Error"; message: string; elapsedMs: number }>;
  onCancel: () => void;
  onSave: (payload: ProfileFormSavePayload) => Promise<void> | void;
}

interface SmokeUiState {
  status: "idle" | "running" | "success" | "error";
  message: string;
  elapsedMs?: number;
}

const PROTOCOL_OPTIONS: {
  value: AiEndpointProtocol;
  label: string;
  defaultBaseUrl: string;
  defaultRunner: AiRunner;
}[] = [
  {
    value: "AnthropicMessages",
    label: "Anthropic Messages",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    defaultRunner: "AnthropicMessages",
  },
  {
    value: "OpenAiChatCompletionsCompatible",
    label: "OpenAI Chat Completions",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultRunner: "OpenAiChatCompletions",
  },
];

interface FormState {
  profileName: string;
  model: string;
  runner: AiRunner;
  effort: string;
  connectionMode: ConnectionMode;
  existingEndpointRef: string;
  newEndpointName: string;
  newProtocol: AiEndpointProtocol;
  newBaseUrl: string;
  credentialMode: CredentialMode;
  existingCredentialRef: string;
  newCredentialName: string;
  newCredentialSourceKind: "Keychain" | "Env";
  newCredentialEnvVar: string;
  newCredentialSecret: string;
  routedTasks: Set<string>;
}

function initialState(config: AiProviderConfig, mode: Mode, profileName?: string): FormState {
  if (mode === "edit" && profileName) {
    const profile = config.profiles.find((p) => p.name === profileName);
    const endpoint = profile ? config.endpoints.find((e) => e.name === profile.endpoint_ref) : undefined;
    const routedTasks = new Set(
      Object.entries(config.routing).filter(([, p]) => p === profileName).map(([t]) => t),
    );
    const settings = (profile?.settings as Record<string, unknown>) ?? {};
    const effort =
      (settings.effort as string | undefined) ?? (settings.reasoning_effort as string | undefined) ?? "";
    return {
      profileName: profile?.name ?? "",
      model: profile?.model ?? "",
      runner: profile?.runner ?? "AnthropicMessages",
      effort,
      connectionMode: "existing",
      existingEndpointRef: endpoint?.name ?? "",
      newEndpointName: "",
      newProtocol: "AnthropicMessages",
      newBaseUrl: PROTOCOL_OPTIONS[0].defaultBaseUrl,
      credentialMode: "existing",
      existingCredentialRef: endpoint?.credential_ref ?? "",
      newCredentialName: "",
      newCredentialSourceKind: "Keychain",
      newCredentialEnvVar: "",
      newCredentialSecret: "",
      routedTasks,
    };
  }
  return {
    profileName: "",
    model: "",
    runner: "AnthropicMessages",
    effort: "",
    connectionMode: config.endpoints.length > 0 ? "existing" : "new",
    existingEndpointRef: config.endpoints[0]?.name ?? "",
    newEndpointName: "",
    newProtocol: "AnthropicMessages",
    newBaseUrl: PROTOCOL_OPTIONS[0].defaultBaseUrl,
    credentialMode: config.credentials.length > 0 ? "existing" : "new",
    existingCredentialRef: config.credentials[0]?.name ?? "",
    newCredentialName: "",
    newCredentialSourceKind: "Keychain",
    newCredentialEnvVar: "",
    newCredentialSecret: "",
    routedTasks: new Set(),
  };
}

function validate(
  state: FormState,
  config: AiProviderConfig,
  _mode: Mode,
  originalName?: string,
): string[] {
  const errors: string[] = [];
  if (!state.profileName.trim()) errors.push("Profile name is required.");
  else if (
    state.profileName !== originalName &&
    config.profiles.some((p) => p.name === state.profileName)
  )
    errors.push(`A profile named "${state.profileName}" already exists.`);
  if (!state.model.trim()) errors.push("Model is required.");
  if (state.connectionMode === "new") {
    if (!state.newEndpointName.trim()) errors.push("Endpoint name is required.");
    // Duplicate-name check must run regardless of profile mode. In edit mode
    // a collision would have caused saveAiProviderConfig to fail at the
    // validator and the persist rollback to delete the colliding (legit)
    // credential's secret — see PR #30 review notes.
    else if (config.endpoints.some((e) => e.name === state.newEndpointName))
      errors.push(`An endpoint named "${state.newEndpointName}" already exists.`);
    if (!state.newBaseUrl.trim()) errors.push("Base URL is required.");
    if (state.credentialMode === "new") {
      if (!state.newCredentialName.trim()) errors.push("Credential name is required.");
      else if (config.credentials.some((c) => c.name === state.newCredentialName))
        errors.push(`A credential named "${state.newCredentialName}" already exists.`);
      if (state.newCredentialSourceKind === "Keychain" && !state.newCredentialSecret) {
        errors.push("Secret value is required for Keychain-stored credentials.");
      }
      if (state.newCredentialSourceKind === "Env" && !state.newCredentialEnvVar.trim()) {
        errors.push("Environment variable name is required.");
      }
    } else if (!state.existingCredentialRef) {
      errors.push("Pick an existing credential.");
    }
  } else if (!state.existingEndpointRef) {
    errors.push("Pick an existing connection.");
  }
  return errors;
}

function applyCascade(
  base: AiProviderConfig,
  state: FormState,
  mode: Mode,
  originalName: string | undefined,
): AiProviderConfig {
  let credentials = base.credentials;
  let endpoints = base.endpoints;
  let profiles = base.profiles;
  const routing = { ...base.routing };

  let credentialRef = state.existingCredentialRef;
  let endpointRef = state.existingEndpointRef;
  let runner: AiRunner = state.runner;

  if (state.connectionMode === "new") {
    if (state.credentialMode === "new") {
      const newCred: AiCredentialConfig = {
        name: state.newCredentialName,
        kind: "ApiKey",
        source:
          state.newCredentialSourceKind === "Keychain"
            ? { type: "Keychain", key_ref: `ai.credentials.${state.newCredentialName}` }
            : { type: "Env", var_name: state.newCredentialEnvVar },
      };
      credentials = [...credentials, newCred];
      credentialRef = newCred.name;
    }
    const protocolOpt = PROTOCOL_OPTIONS.find((p) => p.value === state.newProtocol)!;
    const newEndpoint: AiEndpointConfig = {
      name: state.newEndpointName,
      protocol: state.newProtocol,
      base_url: state.newBaseUrl,
      credential_ref: credentialRef,
    };
    endpoints = [...endpoints, newEndpoint];
    endpointRef = newEndpoint.name;
    runner = protocolOpt.defaultRunner;
  } else {
    const endpoint = endpoints.find((e) => e.name === endpointRef);
    if (endpoint) {
      const protocolOpt = PROTOCOL_OPTIONS.find((p) => p.value === endpoint.protocol)!;
      runner = protocolOpt.defaultRunner;
    }
  }

  // Preserve unknown settings from the original profile (notably `_yaml_runner`,
  // `thinking`, beta header filters, etc.) so YAML-edit → form-edit doesn't
  // silently drop data. Only the form-managed knobs (effort/reasoning_effort)
  // are overwritten.
  const originalProfile =
    mode === "edit" && originalName
      ? base.profiles.find((p) => p.name === originalName)
      : undefined;
  const settings: Record<string, unknown> = {
    ...((originalProfile?.settings as Record<string, unknown> | undefined) ?? {}),
  };
  delete settings.effort;
  delete settings.reasoning_effort;
  // If the form switched the runner family, the preserved `_yaml_runner` hint
  // becomes stale (e.g. `anthropic_direct` paired with the OpenAI runner). Drop
  // it so the serializer falls back to the family-default runner name.
  if (originalProfile && originalProfile.runner !== runner) {
    delete settings._yaml_runner;
  }
  if (state.effort) {
    if (runner === "AnthropicMessages") settings.effort = state.effort;
    else settings.reasoning_effort = state.effort;
  }

  const updatedProfile: AiProfileConfig = {
    name: state.profileName,
    endpoint_ref: endpointRef,
    model: state.model,
    runner,
    execution_mode: "DirectApi",
    settings,
  };

  if (mode === "edit" && originalName) {
    profiles = profiles.map((p) => (p.name === originalName ? updatedProfile : p));
    if (originalName !== state.profileName) {
      for (const [task, p] of Object.entries(routing)) {
        if (p === originalName) routing[task] = state.profileName;
      }
    }
  } else {
    profiles = [...profiles, updatedProfile];
  }

  for (const task of ROUTING_TASKS) {
    const wantsRoute = state.routedTasks.has(task);
    const currentlyRoutesHere = routing[task] === state.profileName;
    if (wantsRoute && !currentlyRoutesHere) routing[task] = state.profileName;
    if (!wantsRoute && currentlyRoutesHere) delete routing[task];
  }

  return {
    version: base.version,
    credentials,
    endpoints,
    profiles,
    routing,
  };
}

export function ProfileForm({
  mode,
  config,
  initialProfileName,
  onTest,
  onCancel,
  onSave,
}: ProfileFormProps) {
  const [state, setState] = useState<FormState>(() => initialState(config, mode, initialProfileName));
  const [smoke, setSmoke] = useState<SmokeUiState>({ status: "idle", message: "" });
  const originalName = mode === "edit" ? initialProfileName : undefined;

  const errors = useMemo(
    () => validate(state, config, mode, originalName),
    [state, config, mode, originalName],
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  const toggleRoute = (task: string, on: boolean) => {
    setState((s) => {
      const next = new Set(s.routedTasks);
      if (on) next.add(task);
      else next.delete(task);
      return { ...s, routedTasks: next };
    });
  };

  const routingConflicts = useMemo(() => {
    const conflicts: { task: string; currentlyAssigned: string }[] = [];
    for (const task of state.routedTasks) {
      const current = config.routing[task];
      if (current && current !== originalName) {
        conflicts.push({ task, currentlyAssigned: current });
      }
    }
    return conflicts;
  }, [state.routedTasks, config.routing, originalName]);

  const cascadeWarning = useMemo(() => {
    if (mode !== "edit" || !originalName) return null;
    if (state.profileName === originalName) return null;
    const affected = Object.entries(config.routing).filter(([, p]) => p === originalName);
    if (affected.length === 0) return null;
    return {
      from: originalName,
      to: state.profileName,
      tasks: affected.map(([t]) => t),
    };
  }, [mode, originalName, state.profileName, config.routing]);

  async function handleTestConnection() {
    if (!onTest) return;
    setSmoke({ status: "running", message: "" });
    try {
      const result = await onTest();
      setSmoke({
        status: result.status === "Success" ? "success" : "error",
        message: result.message,
        elapsedMs: result.elapsedMs,
      });
    } catch (e) {
      setSmoke({
        status: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  function handleSubmit() {
    if (errors.length > 0) return;
    const next = applyCascade(config, state, mode, originalName);
    const pendingSecret =
      state.connectionMode === "new" &&
      state.credentialMode === "new" &&
      state.newCredentialSourceKind === "Keychain" &&
      state.newCredentialSecret
        ? { credentialName: state.newCredentialName, value: state.newCredentialSecret }
        : undefined;
    void onSave({ next, pendingSecret });
  }

  const protocolOpt = PROTOCOL_OPTIONS.find((p) => p.value === state.newProtocol)!;

  return (
    <Form
      onSubmit={handleSubmit}
      aria-label={mode === "edit" ? "Edit AI profile" : "Add AI profile"}
      className="max-w-2xl"
    >
      <header>
        <h2 className="text-lg font-semibold text-text">
          {mode === "edit" ? `Edit ${initialProfileName}` : "Add AI profile"}
        </h2>
        <p className="text-sm text-subtext">
          Wire up a model, an endpoint, and the credential it uses, all on one screen.
          Secrets stay in your OS keychain or as environment variable references — never
          in this form&apos;s saved state.
        </p>
      </header>

      <Field label="Profile name" help="Used in routing and shown in the list.">
        {({ id, describedBy }) => (
          <TextField
            id={id}
            aria-describedby={describedBy}
            value={state.profileName}
            onChange={(e) => update("profileName", e.target.value)}
            placeholder="e.g. anthropic-sonnet"
          />
        )}
      </Field>

      {cascadeWarning && (
        <div className="flex items-start gap-2 rounded border border-yellow/40 bg-yellow/10 p-3 text-xs text-text">
          <AlertTriangle size={14} className="text-yellow mt-0.5 shrink-0" aria-hidden />
          <div>
            <div className="font-medium">
              Renaming will cascade to {cascadeWarning.tasks.length} routing task
              {cascadeWarning.tasks.length === 1 ? "" : "s"}.
            </div>
            <div className="text-subtext mt-0.5">
              <span className="font-mono">{cascadeWarning.from}</span> →{" "}
              <span className="font-mono">{cascadeWarning.to}</span> in:{" "}
              <span className="font-mono">{cascadeWarning.tasks.join(", ")}</span>
            </div>
          </div>
        </div>
      )}

      <Form.Section label="Connection">
        <RadioGroup
          aria-label="Connection mode"
          value={state.connectionMode}
          onValueChange={(v) => update("connectionMode", v as ConnectionMode)}
        >
          <RadioGroup.Item
            value="existing"
            label={`Use existing connection${config.endpoints.length === 0 ? " (none yet)" : ""}`}
            disabled={config.endpoints.length === 0}
          />
          <RadioGroup.Item value="new" label="Create new connection" />
        </RadioGroup>

        {state.connectionMode === "existing" && config.endpoints.length > 0 && (
          <Field label="Connection">
            {() => (
              <Select
                aria-label="Connection"
                value={state.existingEndpointRef}
                onValueChange={(v) => update("existingEndpointRef", v)}
                options={config.endpoints.map((e) => ({
                  value: e.name,
                  label: `${e.name} — ${e.protocol === "AnthropicMessages" ? "anthropic" : "openai"} · ${e.credential_ref}`,
                }))}
              />
            )}
          </Field>
        )}

        {state.connectionMode === "new" && (
          <div className="flex flex-col gap-3 pl-2 border-l-2 border-border">
            <Field label="Endpoint name" help="Internal label — shown nowhere outside this app.">
              {({ id }) => (
                <TextField
                  id={id}
                  value={state.newEndpointName}
                  onChange={(e) => update("newEndpointName", e.target.value)}
                  placeholder="e.g. anthropic-direct"
                />
              )}
            </Field>
            <Field label="Protocol">
              {() => (
                <Select
                  aria-label="Protocol"
                  value={state.newProtocol}
                  onValueChange={(v) => {
                    const opt = PROTOCOL_OPTIONS.find((p) => p.value === v)!;
                    setState((s) => ({
                      ...s,
                      newProtocol: v as AiEndpointProtocol,
                      newBaseUrl: opt.defaultBaseUrl,
                      runner: opt.defaultRunner,
                    }));
                  }}
                  options={PROTOCOL_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
                />
              )}
            </Field>
            <Field label="Base URL">
              {({ id }) => (
                <TextField
                  id={id}
                  value={state.newBaseUrl}
                  onChange={(e) => update("newBaseUrl", e.target.value)}
                  placeholder={protocolOpt.defaultBaseUrl}
                />
              )}
            </Field>

            <h4 className="text-xs font-semibold text-subtext uppercase tracking-wider mt-2">
              Credential
            </h4>
            <RadioGroup
              aria-label="Credential mode"
              value={state.credentialMode}
              onValueChange={(v) => update("credentialMode", v as CredentialMode)}
            >
              <RadioGroup.Item
                value="existing"
                label={`Use existing credential${config.credentials.length === 0 ? " (none yet)" : ""}`}
                disabled={config.credentials.length === 0}
              />
              <RadioGroup.Item value="new" label="Create new credential" />
            </RadioGroup>

            {state.credentialMode === "existing" && config.credentials.length > 0 && (
              <Field label="Credential">
                {() => (
                  <Select
                    aria-label="Credential"
                    value={state.existingCredentialRef}
                    onValueChange={(v) => update("existingCredentialRef", v)}
                    options={config.credentials.map((c) => ({
                      value: c.name,
                      label: `${c.name} — ${c.kind} · ${c.source.type}${c.source.type === "Env" ? ` ($${c.source.var_name})` : ""}`,
                    }))}
                  />
                )}
              </Field>
            )}

            {state.credentialMode === "new" && (
              <div className="flex flex-col gap-3 pl-2 border-l-2 border-border">
                <Field label="Credential name">
                  {({ id }) => (
                    <TextField
                      id={id}
                      value={state.newCredentialName}
                      onChange={(e) => update("newCredentialName", e.target.value)}
                      placeholder="e.g. personal-anthropic"
                    />
                  )}
                </Field>
                <Field label="Source">
                  {() => (
                    <RadioGroup
                      aria-label="Credential source"
                      value={state.newCredentialSourceKind}
                      onValueChange={(v) => update("newCredentialSourceKind", v as "Keychain" | "Env")}
                    >
                      <RadioGroup.Item value="Keychain" label="Store secret in OS keychain" />
                      <RadioGroup.Item value="Env" label="Read from environment variable" />
                    </RadioGroup>
                  )}
                </Field>
                {state.newCredentialSourceKind === "Keychain" ? (
                  <Field
                    label="Secret value"
                    help="Stored in the OS keychain. Never written to this form's saved state."
                  >
                    {({ id }) => (
                      <TextField
                        id={id}
                        type="password"
                        value={state.newCredentialSecret}
                        onChange={(e) => update("newCredentialSecret", e.target.value)}
                        placeholder="sk-…"
                      />
                    )}
                  </Field>
                ) : (
                  <Field label="Environment variable">
                    {({ id }) => (
                      <TextField
                        id={id}
                        value={state.newCredentialEnvVar}
                        onChange={(e) => update("newCredentialEnvVar", e.target.value)}
                        placeholder="ANTHROPIC_API_KEY"
                      />
                    )}
                  </Field>
                )}
              </div>
            )}
          </div>
        )}
      </Form.Section>

      <Form.Section label="Model">
        <Field label="Model" help="The model ID expected by the endpoint protocol.">
          {({ id }) => (
            <TextField
              id={id}
              value={state.model}
              onChange={(e) => update("model", e.target.value)}
              placeholder="claude-sonnet-4-6"
            />
          )}
        </Field>
        <Field label="Effort hint (optional)" help="Maps to anthropic.effort or openai.reasoning_effort.">
          {() => (
            <Select
              aria-label="Effort"
              value={state.effort || "__none"}
              onValueChange={(v) => update("effort", v === "__none" ? "" : v)}
              options={[
                { value: "__none", label: "(none)" },
                { value: "low", label: "low" },
                { value: "medium", label: "medium" },
                { value: "high", label: "high" },
              ]}
            />
          )}
        </Field>
      </Form.Section>

      <Form.Section label="Routing" description="Pick which workflow tasks route to this profile. Checking a task currently routed elsewhere will reassign it.">
        <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
          {ROUTING_TASKS.map((task) => {
            const conflict = routingConflicts.find((c) => c.task === task);
            return (
              <div key={task} className="flex items-center gap-1.5">
                <Checkbox
                  label={task}
                  checked={state.routedTasks.has(task)}
                  onCheckedChange={(v) => toggleRoute(task, v === true)}
                />
                {conflict && (
                  <span className="text-xs text-yellow" title={`Currently: ${conflict.currentlyAssigned}`}>
                    reassign from {conflict.currentlyAssigned}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Form.Section>

      {onTest && (
        <section className="flex flex-col gap-2 rounded border border-border bg-mantle p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold text-subtext uppercase tracking-wider">Test connection</h3>
              <p className="text-xs text-subtext-1 mt-0.5">
                Runs the smoke test against the saved profile. Save first to test changes.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleTestConnection}
              disabled={smoke.status === "running"}
            >
              <FlaskConical size={12} className="mr-1.5" />
              {smoke.status === "running" ? "Testing…" : "Test"}
            </Button>
          </div>
          {smoke.status === "success" && (
            <p className="text-xs text-green">✓ Success · {smoke.elapsedMs}ms</p>
          )}
          {smoke.status === "error" && (
            <p className="text-xs text-red">✗ {smoke.message}</p>
          )}
        </section>
      )}

      {errors.length > 0 && (
        <Form.Error>
          <ul className="flex flex-col gap-1">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Form.Error>
      )}

      <Form.Actions>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={errors.length > 0}>
          {mode === "edit" ? "Save changes" : "Add profile"}
        </Button>
      </Form.Actions>
    </Form>
  );
}
