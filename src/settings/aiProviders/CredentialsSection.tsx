import { useState } from "react";
import { EMPTY_STATES } from "../../aiProviders/defaults";
import { setAiCredentialSecret } from "../../aiProviders/storage";
import type {
  AiCredentialConfig,
  AiCredentialKind,
  AiProviderConfig,
  CredentialSource,
} from "../../aiProviders/types";

interface Props {
  config: AiProviderConfig;
  onChange: (next: AiProviderConfig) => void;
}

export function CredentialsSection({ config, onChange }: Props) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AiCredentialKind>("ApiKey");
  const [sourceType, setSourceType] = useState<"Keychain" | "Env">("Keychain");
  const [varName, setVarName] = useState("");
  const [secretValues, setSecretValues] = useState<Record<string, string>>({});
  const [secretStatus, setSecretStatus] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    setError(null);
    if (!name.trim()) {
      setError("Credential name is required");
      return;
    }
    if (config.credentials.some((c) => c.name === name)) {
      setError(`Credential "${name}" already exists`);
      return;
    }
    const source: CredentialSource =
      sourceType === "Keychain"
        ? { type: "Keychain", key_ref: `ai.credentials.${name}` }
        : { type: "Env", var_name: varName };
    if (sourceType === "Env" && !varName.trim()) {
      setError("Environment variable name is required");
      return;
    }
    const newCred: AiCredentialConfig = { name, kind, source };
    onChange({ ...config, credentials: [...config.credentials, newCred] });
    setName("");
    setVarName("");
  };

  const handleDelete = (credName: string) => {
    setError(null);
    const usedBy = config.endpoints.find((e) => e.credential_ref === credName);
    if (usedBy) {
      setError(`Cannot delete: used by endpoint ${usedBy.name}`);
      return;
    }
    onChange({
      ...config,
      credentials: config.credentials.filter((c) => c.name !== credName),
    });
  };

  const handleSetSecret = async (credName: string) => {
    const value = secretValues[credName] ?? "";
    if (!value) {
      setSecretStatus((s) => ({ ...s, [credName]: "Secret value is required" }));
      return;
    }
    const result = await setAiCredentialSecret(credName, value);
    if (result.ok) {
      setSecretStatus((s) => ({ ...s, [credName]: "Secret saved" }));
      setSecretValues((v) => ({ ...v, [credName]: "" }));
    } else {
      setSecretStatus((s) => ({ ...s, [credName]: result.error }));
    }
  };

  return (
    <section aria-labelledby="credentials-heading" className="mt-6">
      <h3 id="credentials-heading" className="text-sm font-semibold text-text mb-2">
        Credentials
      </h3>
      {config.credentials.length === 0 ? (
        <p className="text-sm text-subtext mb-3">{EMPTY_STATES.credentials}</p>
      ) : (
        <ul className="mb-3 divide-y divide-border rounded border border-border">
          {config.credentials.map((c) => (
            <li key={c.name} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-text">{c.name}</p>
                  <p className="text-xs text-subtext">
                    {c.kind} · {c.source.type}
                    {c.source.type === "Env" ? ` (${c.source.var_name})` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(c.name)}
                  className="text-xs text-subtext hover:text-text"
                >
                  Delete
                </button>
              </div>
              {c.source.type === "Keychain" && (
                <div className="mt-2 flex items-center gap-2">
                  <label className="sr-only" htmlFor={`secret-${c.name}`}>
                    Secret value for {c.name}
                  </label>
                  <input
                    id={`secret-${c.name}`}
                    type="password"
                    value={secretValues[c.name] ?? ""}
                    onChange={(e) =>
                      setSecretValues((s) => ({ ...s, [c.name]: e.target.value }))
                    }
                    placeholder="Secret value"
                    className="flex-1 px-2 py-1 text-sm rounded border border-border bg-surface text-text"
                  />
                  <button
                    type="button"
                    onClick={() => handleSetSecret(c.name)}
                    className="text-xs px-2 py-1 rounded border border-border bg-surface hover:bg-surface-1 text-text"
                  >
                    Set secret
                  </button>
                </div>
              )}
              {secretStatus[c.name] && (
                <p className="text-xs text-subtext mt-1">{secretStatus[c.name]}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="rounded border border-border p-3">
        <h4 className="text-xs font-semibold text-subtext uppercase tracking-wider mb-2">
          Add credential
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
            Kind
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as AiCredentialKind)}
              className="px-2 py-1 text-sm rounded border border-border bg-surface text-text"
            >
              <option value="ApiKey">ApiKey</option>
              <option value="BearerToken">BearerToken</option>
              <option value="AwsIamProfile">AwsIamProfile</option>
            </select>
          </label>
          <label className="text-xs text-subtext flex flex-col gap-1">
            Source
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as "Keychain" | "Env")}
              className="px-2 py-1 text-sm rounded border border-border bg-surface text-text"
            >
              <option value="Keychain">Keychain</option>
              <option value="Env">Env</option>
            </select>
          </label>
          {sourceType === "Env" && (
            <label className="text-xs text-subtext flex flex-col gap-1">
              Environment variable
              <input
                type="text"
                value={varName}
                onChange={(e) => setVarName(e.target.value)}
                className="px-2 py-1 text-sm rounded border border-border bg-surface text-text"
              />
            </label>
          )}
          <button
            type="button"
            onClick={handleAdd}
            className="self-start text-xs px-3 py-1 rounded border border-border bg-surface hover:bg-surface-1 text-text"
          >
            Add credential
          </button>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>
    </section>
  );
}
