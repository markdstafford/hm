import { useCallback, useEffect, useState } from "react";
import { EMPTY_AI_PROVIDER_CONFIG } from "../aiProviders/defaults";
import {
  loadAiProviderConfig,
  saveAiProviderConfig,
} from "../aiProviders/storage";
import type { AiProviderConfig } from "../aiProviders/types";
import { CredentialsSection } from "./aiProviders/CredentialsSection";
import { EndpointsSection } from "./aiProviders/EndpointsSection";
import { ProfilesSection } from "./aiProviders/ProfilesSection";
import { RoutingSection } from "./aiProviders/RoutingSection";

export function AiProvidersSettings() {
  const [config, setConfig] = useState<AiProviderConfig>(EMPTY_AI_PROVIDER_CONFIG);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadAiProviderConfig();
        if (!cancelled) {
          setConfig(loaded);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = useCallback(async (updated: AiProviderConfig) => {
    setConfig(updated);
    const result = await saveAiProviderConfig(updated);
    if (!result.ok) {
      setSaveError(result.error);
    } else {
      setSaveError(null);
    }
  }, []);

  return (
    <div>
      <h2 className="text-md font-semibold text-text mb-1">AI providers</h2>
      <p className="text-sm text-subtext mb-4">
        Configure credentials, endpoints, model profiles, and task routing.
      </p>

      {loading && <p className="text-sm text-subtext">Loading…</p>}
      {loadError && (
        <p className="text-sm text-red-500">Failed to load: {loadError}</p>
      )}

      {!loading && !loadError && (
        <>
          <CredentialsSection config={config} onChange={handleChange} />
          <EndpointsSection config={config} onChange={handleChange} />
          <ProfilesSection config={config} onChange={handleChange} />
          <RoutingSection config={config} onChange={handleChange} />
          {saveError && (
            <p className="text-sm text-red-500 mt-4">Save failed: {saveError}</p>
          )}
        </>
      )}
    </div>
  );
}
