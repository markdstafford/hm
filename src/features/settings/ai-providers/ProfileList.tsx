import { FlaskConical, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import type { AiProviderConfig, AiProfileConfig } from "../../../aiProviders/types";
import { Button } from "../../../ui/buttons/Button";
import { IconButton } from "../../../ui/buttons/IconButton";
import { Card } from "../../../ui/layout/Card";
import { Tooltip } from "../../../ui/overlays/Tooltip";
import { EmptyState } from "../../../ui/feedback/EmptyState";
import { StatusDot } from "../../../ui/feedback/StatusDot";

export type SmokeState =
  | { status: "NotRun" }
  | { status: "Running" }
  | { status: "Success"; testedAtIso: string; elapsedMs: number; message: string }
  | { status: "Error"; testedAtIso: string; elapsedMs: number; message: string };

interface ProfileListProps {
  config: AiProviderConfig;
  smokeState: Record<string, SmokeState>;
  onAdd: () => void;
  onEdit: (profileName: string) => void;
  onTest: (profileName: string) => void;
  onRemove: (profileName: string) => void;
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function routingBadges(name: string, routing: Record<string, string>): string[] {
  return Object.entries(routing).filter(([, p]) => p === name).map(([t]) => t);
}

function smokeRow(state: SmokeState | undefined) {
  if (!state || state.status === "NotRun") {
    return (
      <span className="text-xs text-subtext-1 flex items-center gap-1.5">
        <StatusDot tone="subtext" />Not tested
      </span>
    );
  }
  if (state.status === "Running") {
    return (
      <span className="text-xs text-subtext flex items-center gap-1.5">
        <StatusDot tone="primary" />Testing…
      </span>
    );
  }
  if (state.status === "Success") {
    return (
      <span className="text-xs text-subtext flex items-center gap-1.5">
        <StatusDot tone="green" />Success · {state.elapsedMs}ms · {relativeTime(state.testedAtIso)}
      </span>
    );
  }
  return (
    <span className="text-xs text-red flex items-center gap-1.5">
      <StatusDot tone="red" />Failed · {relativeTime(state.testedAtIso)}{" "}
      <span className="text-subtext-1">— {state.message}</span>
    </span>
  );
}

function effortPill(profile: AiProfileConfig): string | null {
  const s = (profile.settings ?? {}) as Record<string, unknown>;
  const effort = s.effort as string | undefined;
  const reasoning = s.reasoning_effort as string | undefined;
  if (effort) return `effort: ${effort}`;
  if (reasoning) return `reasoning: ${reasoning}`;
  return null;
}

function ProfileRow({
  profile,
  endpointBaseUrl,
  credentialRef,
  credentialSourceLabel,
  routedTasks,
  smoke,
  onEdit,
  onTest,
  onRemove,
}: {
  profile: AiProfileConfig;
  endpointBaseUrl: string;
  credentialRef: string;
  credentialSourceLabel: string;
  routedTasks: string[];
  smoke: SmokeState | undefined;
  onEdit: () => void;
  onTest: () => void;
  onRemove: () => void;
}) {
  const runnerLabel =
    profile.runner === "AnthropicMessages"
      ? "Anthropic Messages"
      : profile.runner === "OpenAiEmbeddings"
        ? "OpenAI Embeddings"
        : "OpenAI Chat";
  let host = endpointBaseUrl;
  try { host = new URL(endpointBaseUrl).hostname; } catch { /* keep */ }
  const pill = effortPill(profile);
  return (
    <li>
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-text truncate">{profile.name}</span>
              {pill && (
                <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-surface text-subtext">
                  {pill}
                </span>
              )}
            </div>
            <div className="text-xs text-subtext mt-0.5 truncate">
              <span className="font-mono">{profile.model}</span>
              <span className="mx-1.5 text-subtext-1">·</span>
              {runnerLabel}
              <span className="mx-1.5 text-subtext-1">·</span>
              <span className="font-mono">{host}</span>
            </div>
            <div className="text-xs text-subtext-1 mt-0.5 truncate">
              Credential: <span className="font-mono">{credentialRef}</span>{" "}
              <span className="text-subtext-1">({credentialSourceLabel})</span>
            </div>
            {routedTasks.length > 0 && (
              <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                <Sparkles size={10} className="text-primary" aria-hidden />
                {routedTasks.map((t) => (
                  <span
                    key={t}
                    className="text-xs font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-1.5">{smokeRow(smoke)}</div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Tooltip content="Test connection">
              <IconButton label="Test connection" onClick={onTest}><FlaskConical size={12} /></IconButton>
            </Tooltip>
            <Tooltip content="Edit profile">
              <IconButton label="Edit profile" onClick={onEdit}><Pencil size={12} /></IconButton>
            </Tooltip>
            <Tooltip content="Remove profile">
              <IconButton label="Remove profile" onClick={onRemove}><Trash2 size={12} /></IconButton>
            </Tooltip>
          </div>
        </div>
      </Card>
    </li>
  );
}

export function ProfileList({ config, smokeState, onAdd, onEdit, onTest, onRemove }: ProfileListProps) {
  const credentialsByName = new Map(config.credentials.map((c) => [c.name, c]));
  const endpointsByName = new Map(config.endpoints.map((e) => [e.name, e]));

  if (config.profiles.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles size={20} />}
        title="No AI profiles configured"
        description="Add a profile to wire up an AI provider for tasks like planning, review, and triage."
        action={
          <Button variant="primary" onClick={onAdd}>
            <Plus size={12} className="mr-1.5" />Add profile
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-subtext">
          {config.profiles.length} profile{config.profiles.length === 1 ? "" : "s"} ·{" "}
          {Object.keys(config.routing).length} routing slot{Object.keys(config.routing).length === 1 ? "" : "s"} wired
        </p>
        <Button variant="primary" size="sm" onClick={onAdd}>
          <Plus size={12} className="mr-1.5" />Add profile
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {config.profiles.map((p) => {
          const endpoint = endpointsByName.get(p.endpoint_ref);
          const cred = endpoint && credentialsByName.get(endpoint.credential_ref);
          const credentialSourceLabel =
            cred?.source.type === "Keychain"
              ? "from Keychain"
              : cred?.source.type === "Env"
              ? `from $${cred.source.var_name}`
              : "missing";
          return (
            <ProfileRow
              key={p.name}
              profile={p}
              endpointBaseUrl={endpoint?.base_url ?? ""}
              credentialRef={endpoint?.credential_ref ?? "(none)"}
              credentialSourceLabel={credentialSourceLabel}
              routedTasks={routingBadges(p.name, config.routing)}
              smoke={smokeState[p.name]}
              onEdit={() => onEdit(p.name)}
              onTest={() => onTest(p.name)}
              onRemove={() => onRemove(p.name)}
            />
          );
        })}
      </ul>
    </div>
  );
}
