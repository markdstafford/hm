import { useState } from "react";
import { EMPTY_STATES } from "../../aiProviders/defaults";
import type {
  AiEndpointConfig,
  AiEndpointProtocol,
  AiProviderConfig,
} from "../../aiProviders/types";

interface Props {
  config: AiProviderConfig;
  onChange: (next: AiProviderConfig) => void;
}

export function EndpointsSection({ config, onChange }: Props) {
  const [name, setName] = useState("");
  const [protocol, setProtocol] = useState<AiEndpointProtocol>("AnthropicMessages");
  const [baseUrl, setBaseUrl] = useState("");
  const [credRef, setCredRef] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    setError(null);
    if (!name.trim()) {
      setError("Endpoint name is required");
      return;
    }
    if (config.endpoints.some((e) => e.name === name)) {
      setError(`Endpoint "${name}" already exists`);
      return;
    }
    if (!baseUrl.trim()) {
      setError("Base URL is required");
      return;
    }
    if (!credRef) {
      setError("Credential is required");
      return;
    }
    const newEndpoint: AiEndpointConfig = {
      name,
      protocol,
      base_url: baseUrl,
      credential_ref: credRef,
    };
    onChange({ ...config, endpoints: [...config.endpoints, newEndpoint] });
    setName("");
    setBaseUrl("");
    setCredRef("");
  };

  const handleDelete = (endpointName: string) => {
    setError(null);
    const usedBy = config.profiles.find((p) => p.endpoint_ref === endpointName);
    if (usedBy) {
      setError(`Cannot delete: used by profile ${usedBy.name}`);
      return;
    }
    onChange({
      ...config,
      endpoints: config.endpoints.filter((e) => e.name !== endpointName),
    });
  };

  return (
    <section aria-labelledby="endpoints-heading" className="mt-6">
      <h3 id="endpoints-heading" className="text-sm font-semibold text-text mb-2">
        Endpoints
      </h3>
      {config.endpoints.length === 0 ? (
        <p className="text-sm text-subtext mb-3">{EMPTY_STATES.endpoints}</p>
      ) : (
        <ul className="mb-3 divide-y divide-border rounded border border-border">
          {config.endpoints.map((e) => (
            <li key={e.name} className="p-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-text">{e.name}</p>
                <p className="text-xs text-subtext">
                  {e.protocol} · {e.base_url} · {e.credential_ref}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(e.name)}
                className="text-xs text-subtext hover:text-text"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded border border-border p-3">
        <h4 className="text-xs font-semibold text-subtext uppercase tracking-wider mb-2">
          Add endpoint
        </h4>
        <div className="grid gap-2">
          <label className="text-xs text-subtext flex flex-col gap-1">
            Name
            <input
              type="text"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              className="px-2 py-1 text-sm rounded border border-border bg-surface text-text"
            />
          </label>
          <label className="text-xs text-subtext flex flex-col gap-1">
            Protocol
            <select
              value={protocol}
              onChange={(ev) => setProtocol(ev.target.value as AiEndpointProtocol)}
              className="px-2 py-1 text-sm rounded border border-border bg-surface text-text"
            >
              <option value="AnthropicMessages">AnthropicMessages</option>
              <option value="OpenAiChatCompletionsCompatible">
                OpenAiChatCompletionsCompatible
              </option>
            </select>
          </label>
          <label className="text-xs text-subtext flex flex-col gap-1">
            Base URL
            <input
              type="text"
              value={baseUrl}
              onChange={(ev) => setBaseUrl(ev.target.value)}
              className="px-2 py-1 text-sm rounded border border-border bg-surface text-text"
            />
          </label>
          <label className="text-xs text-subtext flex flex-col gap-1">
            Credential
            <select
              value={credRef}
              onChange={(ev) => setCredRef(ev.target.value)}
              className="px-2 py-1 text-sm rounded border border-border bg-surface text-text"
            >
              <option value="">Select credential…</option>
              {config.credentials.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleAdd}
            className="self-start text-xs px-3 py-1 rounded border border-border bg-surface hover:bg-surface-1 text-text"
          >
            Add endpoint
          </button>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>
    </section>
  );
}
