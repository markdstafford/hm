import { useState } from "react";
import { EMPTY_STATES, RUNNER_LABELS } from "../../aiProviders/defaults";
import { smokeTestAiProfile } from "../../aiProviders/storage";
import type {
  AiProfileConfig,
  AiProviderConfig,
  AiRunner,
  SmokeTestResult,
} from "../../aiProviders/types";

interface Props {
  config: AiProviderConfig;
  onChange: (next: AiProviderConfig) => void;
}

type LocalSmokeState =
  | { status: "NotRun" }
  | { status: "Running" }
  | { status: "Success"; result: SmokeTestResult }
  | { status: "Error"; result: SmokeTestResult };

export function ProfilesSection({ config, onChange }: Props) {
  const [name, setName] = useState("");
  const [endpointRef, setEndpointRef] = useState("");
  const [model, setModel] = useState("");
  const [runner, setRunner] = useState<AiRunner>("AnthropicMessages");
  const [error, setError] = useState<string | null>(null);
  const [smokeState, setSmokeState] = useState<Record<string, LocalSmokeState>>({});

  const handleAdd = () => {
    setError(null);
    if (!name.trim()) {
      setError("Profile name is required");
      return;
    }
    if (config.profiles.some((p) => p.name === name)) {
      setError(`Profile "${name}" already exists`);
      return;
    }
    if (!endpointRef) {
      setError("Endpoint is required");
      return;
    }
    if (!model.trim()) {
      setError("Model is required");
      return;
    }
    const newProfile: AiProfileConfig = {
      name,
      endpoint_ref: endpointRef,
      model,
      runner,
      execution_mode: "DirectApi",
      settings: {},
    };
    onChange({ ...config, profiles: [...config.profiles, newProfile] });
    setName("");
    setEndpointRef("");
    setModel("");
  };

  const handleDelete = (profileName: string) => {
    setError(null);
    const usedByTask = Object.entries(config.routing).find(
      ([, prof]) => prof === profileName
    );
    if (usedByTask) {
      setError(`Cannot delete: used by routing task ${usedByTask[0]}`);
      return;
    }
    onChange({
      ...config,
      profiles: config.profiles.filter((p) => p.name !== profileName),
    });
  };

  const handleSmokeTest = async (profileName: string) => {
    setSmokeState((s) => ({ ...s, [profileName]: { status: "Running" } }));
    try {
      const result = await smokeTestAiProfile(profileName);
      setSmokeState((s) => ({
        ...s,
        [profileName]:
          result.status === "Success"
            ? { status: "Success", result }
            : { status: "Error", result },
      }));
    } catch (err) {
      setSmokeState((s) => ({
        ...s,
        [profileName]: {
          status: "Error",
          result: {
            status: "Error",
            profile: profileName,
            runner: "OpenAiChatCompletions",
            execution_mode: "DirectApi",
            model: "",
            elapsed_ms: 0,
            preview: null,
            error: err instanceof Error ? err.message : String(err),
            suggested_fix: null,
          },
        },
      }));
    }
  };

  const renderSmokeStatus = (profileName: string) => {
    const st = smokeState[profileName];
    if (!st || st.status === "NotRun")
      return <span className="text-xs text-subtext">not run</span>;
    if (st.status === "Running") return <span className="text-xs text-subtext">running…</span>;
    if (st.status === "Success")
      return (
        <span className="text-xs text-green-600">
          success ({st.result.elapsed_ms}ms)
        </span>
      );
    return (
      <span className="text-xs text-red-500">
        error: {st.result.error ?? "unknown"}
      </span>
    );
  };

  return (
    <section aria-labelledby="profiles-heading" className="mt-6">
      <h3 id="profiles-heading" className="text-sm font-semibold text-text mb-2">
        Profiles
      </h3>
      {config.profiles.length === 0 ? (
        <p className="text-sm text-subtext mb-3">{EMPTY_STATES.profiles}</p>
      ) : (
        <ul className="mb-3 divide-y divide-border rounded border border-border">
          {config.profiles.map((p) => (
            <li key={p.name} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-text">{p.name}</p>
                  <p className="text-xs text-subtext">
                    {RUNNER_LABELS[p.runner] ?? p.runner} · {p.execution_mode} ·{" "}
                    {p.model}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {renderSmokeStatus(p.name)}
                  <button
                    type="button"
                    onClick={() => handleSmokeTest(p.name)}
                    className="text-xs px-2 py-1 rounded border border-border bg-surface hover:bg-surface-1 text-text"
                  >
                    Smoke test
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p.name)}
                    className="text-xs text-subtext hover:text-text"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded border border-border p-3">
        <h4 className="text-xs font-semibold text-subtext uppercase tracking-wider mb-2">
          Add profile
        </h4>
        <div className="grid gap-2">
          <label className="text-xs text-subtext flex flex-col gap-1">
            Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="px-2 py-1 text-sm rounded border border-border bg-surface text-text"
            />
          </label>
          <label className="text-xs text-subtext flex flex-col gap-1">
            Endpoint
            <select
              value={endpointRef}
              onChange={(e) => setEndpointRef(e.target.value)}
              className="px-2 py-1 text-sm rounded border border-border bg-surface text-text"
            >
              <option value="">Select endpoint…</option>
              {config.endpoints.map((ep) => (
                <option key={ep.name} value={ep.name}>
                  {ep.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-subtext flex flex-col gap-1">
            Model
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="px-2 py-1 text-sm rounded border border-border bg-surface text-text"
            />
          </label>
          <label className="text-xs text-subtext flex flex-col gap-1">
            Runner
            <select
              value={runner}
              onChange={(e) => setRunner(e.target.value as AiRunner)}
              className="px-2 py-1 text-sm rounded border border-border bg-surface text-text"
            >
              <option value="AnthropicMessages">{RUNNER_LABELS.AnthropicMessages}</option>
              <option value="OpenAiChatCompletions">
                {RUNNER_LABELS.OpenAiChatCompletions}
              </option>
            </select>
          </label>
          <label className="text-xs text-subtext flex flex-col gap-1">
            Execution mode
            <select
              value="DirectApi"
              disabled
              className="px-2 py-1 text-sm rounded border border-border bg-surface text-text"
            >
              <option value="DirectApi">DirectApi</option>
            </select>
          </label>
          <button
            type="button"
            onClick={handleAdd}
            className="self-start text-xs px-3 py-1 rounded border border-border bg-surface hover:bg-surface-1 text-text"
          >
            Add profile
          </button>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>
    </section>
  );
}
