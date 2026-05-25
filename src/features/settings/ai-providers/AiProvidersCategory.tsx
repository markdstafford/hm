import { useCallback, useEffect, useRef, useState } from "react";
import { Code, List } from "lucide-react";
import { EMPTY_AI_PROVIDER_CONFIG } from "../../../aiProviders/defaults";
import {
  deleteAiCredentialSecret,
  loadAiProviderConfig,
  saveAiProviderConfig,
  setAiCredentialSecret,
  smokeTestAiProfile,
} from "../../../aiProviders/storage";
import type { AiProviderConfig } from "../../../aiProviders/types";
import { validateAiProviderConfig } from "../../../aiProviders/validation";
import { Button } from "../../../ui/buttons/Button";
import { AlertDialog } from "../../../ui/overlays/AlertDialog";
import { ProfileList, type SmokeState } from "./ProfileList";
import { ProfileForm, type ProfileFormSavePayload } from "./ProfileForm";
import { YamlAdvancedView } from "./YamlAdvancedView";

type View =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; profileName: string }
  | { kind: "yaml" };

export function AiProvidersCategory() {
  const [config, setConfig] = useState<AiProviderConfig>(EMPTY_AI_PROVIDER_CONFIG);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [smokeState, setSmokeState] = useState<Record<string, SmokeState>>({});
  const [view, setView] = useState<View>({ kind: "list" });
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAiProviderConfig()
      .then((cfg) => { if (!cancelled) { setConfig(cfg); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setLoadError(String(e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  // Persist a config change. When the form bundles a pending Keychain secret,
  // write the secret first so the credential ref resolves; if the subsequent
  // config save fails, best-effort delete the orphan secret so we don't leak
  // it. Plain config-only writes (remove, YAML apply) skip the secret step.
  //
  // Serialized via inFlightRef so that even if a caller races two calls (e.g.
  // a double-click that slipped past the form's `saving` guard), the second
  // call queues behind the first instead of running concurrent secret writes.
  // Concurrent persists previously could rollback-delete a successfully saved
  // profile's credential.
  const inFlightRef = useRef<Promise<void>>(Promise.resolve());
  const persist = useCallback(
    (payload: ProfileFormSavePayload | { next: AiProviderConfig }): Promise<void> => {
      const run = async () => {
        const next = payload.next;
        const pendingSecret = "pendingSecret" in payload ? payload.pendingSecret : undefined;
        // Pre-flight the config validator before touching the keychain. A
        // duplicate credential name (or any other validator failure) would
        // otherwise let us overwrite an existing keychain entry and then, on
        // config-save failure, the rollback path would delete that legit entry.
        const validationErrors = validateAiProviderConfig(next);
        if (validationErrors.length) {
          setSaveError(validationErrors.join("\n"));
          return;
        }
        if (pendingSecret) {
          const secretResult = await setAiCredentialSecret(
            pendingSecret.credentialName,
            pendingSecret.value,
          );
          if (!secretResult.ok) {
            setSaveError(`Could not store credential secret: ${secretResult.error}`);
            return;
          }
        }
        const result = await saveAiProviderConfig(next);
        if (result.ok) {
          setConfig(next);
          setSaveError(null);
          setView({ kind: "list" });
          return;
        }
        // Config save failed. If we just wrote a secret for a credential that
        // never landed in persisted config, clean it up. Best-effort: a delete
        // failure is not surfaced because the original error is what the user
        // needs to see.
        if (pendingSecret) {
          await deleteAiCredentialSecret(pendingSecret.credentialName);
        }
        setSaveError(result.error);
      };
      const queued = inFlightRef.current.then(run, run);
      inFlightRef.current = queued;
      return queued;
    },
    [],
  );

  const handleTest = useCallback(async (profileName: string) => {
    setSmokeState((s) => ({ ...s, [profileName]: { status: "Running" } }));
    try {
      const result = await smokeTestAiProfile(profileName);
      const now = new Date().toISOString();
      setSmokeState((s) => ({
        ...s,
        [profileName]: result.status === "Success"
          ? { status: "Success", testedAtIso: now, elapsedMs: result.elapsed_ms, message: result.preview ?? "ok" }
          : { status: "Error", testedAtIso: now, elapsedMs: result.elapsed_ms, message: result.error ?? "unknown error" },
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSmokeState((s) => ({
        ...s,
        [profileName]: { status: "Error", testedAtIso: new Date().toISOString(), elapsedMs: 0, message: msg },
      }));
    }
  }, []);

  const handleRemoveConfirm = useCallback(async () => {
    if (!pendingRemove) return;
    const next: AiProviderConfig = {
      ...config,
      profiles: config.profiles.filter((p) => p.name !== pendingRemove),
      routing: Object.fromEntries(
        Object.entries(config.routing).filter(([, p]) => p !== pendingRemove),
      ),
    };
    await persist({ next });
    setPendingRemove(null);
  }, [config, pendingRemove, persist]);

  const showHeader = view.kind === "list" || view.kind === "yaml";

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      {showHeader && (
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-text">AI providers</h1>
            <p className="text-sm text-subtext">
              Profiles bundle a credential, endpoint, model, and routing. One form, one row, no
              hidden layering. Use the YAML view for power-user bulk edits.
            </p>
          </div>
          <div className="inline-flex rounded border border-border p-0.5">
            <button
              type="button"
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                view.kind === "list" ? "bg-surface text-text" : "text-subtext hover:text-text"
              }`}
              onClick={() => setView({ kind: "list" })}
              aria-pressed={view.kind === "list"}
            >
              <List size={11} />Form view
            </button>
            <button
              type="button"
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                view.kind === "yaml" ? "bg-surface text-text" : "text-subtext hover:text-text"
              }`}
              onClick={() => setView({ kind: "yaml" })}
              aria-pressed={view.kind === "yaml"}
            >
              <Code size={11} />YAML view
            </button>
          </div>
        </header>
      )}

      {loading && <p className="text-sm text-subtext">Loading…</p>}
      {loadError && <p className="text-sm text-red">Failed to load: {loadError}</p>}
      {saveError && <p className="text-sm text-red">Save failed: {saveError}</p>}

      {!loading && !loadError && view.kind === "list" && (
        <ProfileList
          config={config}
          smokeState={smokeState}
          onAdd={() => setView({ kind: "create" })}
          onEdit={(name) => setView({ kind: "edit", profileName: name })}
          onTest={handleTest}
          onRemove={(name) => setPendingRemove(name)}
        />
      )}
      {!loading && view.kind === "create" && (
        <ProfileForm
          mode="create"
          config={config}
          onCancel={() => setView({ kind: "list" })}
          onSave={persist}
        />
      )}
      {!loading && view.kind === "edit" && (
        <ProfileForm
          mode="edit"
          config={config}
          initialProfileName={view.profileName}
          onCancel={() => setView({ kind: "list" })}
          onSave={persist}
        />
      )}
      {!loading && view.kind === "yaml" && (
        <YamlAdvancedView
          config={config}
          onSave={(next) => persist({ next })}
          onCancel={() => setView({ kind: "list" })}
        />
      )}

      <AlertDialog.Root open={!!pendingRemove} onOpenChange={(o) => !o && setPendingRemove(null)}>
        <AlertDialog.Content>
          <AlertDialog.Title className="text-sm font-semibold text-text">Remove profile?</AlertDialog.Title>
          <AlertDialog.Description className="text-xs text-subtext mt-2">
            Removes <span className="font-mono">{pendingRemove}</span>. Any routing entries that point
            at it will be unassigned. The underlying credential and endpoint are kept because other
            profiles may share them.
          </AlertDialog.Description>
          <div className="flex justify-end gap-2 mt-4">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="destructive" onClick={handleRemoveConfirm}>Remove profile</Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </div>
  );
}
