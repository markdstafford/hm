import { useState } from "react";
import { AlertTriangle, FileWarning } from "lucide-react";
import type { AiProviderConfig } from "../../../aiProviders/types";
import { Button } from "../../../ui/buttons/Button";
import { configToYaml } from "../../../aiProviders/yaml/serialize";
import { yamlToConfig, YamlParseError } from "../../../aiProviders/yaml/parse";

interface Props {
  config: AiProviderConfig;
  onSave: (next: AiProviderConfig) => void;
  onCancel: () => void;
}

export function YamlAdvancedView({ config, onSave, onCancel }: Props) {
  const [text, setText] = useState(() => configToYaml(config));
  const [error, setError] = useState<string | null>(null);
  const dirty = text !== configToYaml(config);

  function handleApply() {
    try {
      const next = yamlToConfig(text, config);
      setError(null);
      onSave(next);
    } catch (e) {
      setError(e instanceof YamlParseError ? e.message : e instanceof Error ? e.message : String(e));
    }
  }

  function handleDiscard() {
    setText(configToYaml(config));
    setError(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <header>
        <h2 className="text-lg font-semibold text-text">YAML editor</h2>
        <p className="text-sm text-subtext">
          The full <code className="font-mono text-xs">ai:</code> section as one document. Secrets stay as{" "}
          <code className="font-mono text-xs">{"${KEYCHAIN:…}"}</code> /{" "}
          <code className="font-mono text-xs">{"${ENV_VAR}"}</code> sigils.
        </p>
      </header>
      <div className="flex items-start gap-2 rounded border border-yellow/40 bg-yellow/10 p-2 text-xs text-text">
        <FileWarning size={14} className="text-yellow mt-0.5 shrink-0" aria-hidden />
        <div>
          Advanced view bypasses the form&apos;s field-level validation. Cross-reference checks
          (credential → endpoint → profile → routing) still run on save and will block invalid YAML.
        </div>
      </div>
      <textarea
        aria-label="AI providers YAML"
        spellCheck={false}
        className="w-full min-h-[420px] rounded border border-border bg-background text-text px-3 py-2 font-mono text-xs leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        value={text}
        onChange={(e) => { setText(e.target.value); if (error) setError(null); }}
      />
      {error && (
        <div className="flex items-start gap-2 rounded border border-red/40 bg-red/10 p-3 text-xs text-red" role="alert">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          <pre className="font-mono whitespace-pre-wrap leading-5">{error}</pre>
        </div>
      )}
      <footer className="flex items-center justify-between gap-2 pt-2 border-t border-border">
        <span className="text-xs text-subtext-1">
          {dirty ? "Unsaved changes" : "In sync with form view"}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>Back to form</Button>
          <Button variant="secondary" onClick={handleDiscard} disabled={!dirty}>Discard</Button>
          <Button variant="primary" onClick={handleApply} disabled={!dirty}>Apply YAML</Button>
        </div>
      </footer>
    </div>
  );
}
