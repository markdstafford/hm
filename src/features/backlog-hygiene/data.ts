import { useCallback, useEffect, useState } from "react";
import { commands } from "../../bindings";
import type { HygieneSuggestion } from "../../entities/hygiene-suggestion/types";
import type { HygieneSuggestionDto } from "../../bindings";

export type HygieneSuggestionsResult = {
  suggestions: HygieneSuggestion[];
  loading: boolean;
  error: string | null;
  partialFailures: { source: string; message: string }[];
  retry?: () => void;
};

// Map the generated DTO to the existing HygieneSuggestion entity type
export function mapHygieneSuggestion(dto: HygieneSuggestionDto): HygieneSuggestion {
  return {
    id: dto.id,
    category: dto.category as HygieneSuggestion["category"],
    action: dto.action as HygieneSuggestion["action"],
    confidence: dto.confidence,
    rationale: dto.rationale,
    target: {
      key: dto.target.key,
      title: dto.target.title,
      status: dto.target.status,
      assignee: dto.target.assignee,
      updatedAt: dto.target.updated_at,
      body: dto.target.body,
      labels: dto.target.labels ?? [],
    },
    duplicateOf: dto.duplicate_of
      ? {
          key: dto.duplicate_of.key,
          title: dto.duplicate_of.title,
          status: dto.duplicate_of.status,
          assignee: dto.duplicate_of.assignee,
          updatedAt: dto.duplicate_of.updated_at,
          body: dto.duplicate_of.body,
          labels: dto.duplicate_of.labels ?? [],
        }
      : null,
    lastActivityAt: dto.last_activity_at,
    proposed: dto.proposed
      ? {
          title: dto.proposed.title,
          body: dto.proposed.body,
          labels: dto.proposed.labels ?? [],
        }
      : null,
  };
}

// Default loader — calls real Tauri command. Returns empty in browser environments.
async function defaultLoader(): Promise<HygieneSuggestionDto[]> {
  if (typeof window === "undefined" || !(window as any).__TAURI_INTERNALS__) {
    return [];
  }
  const result = await commands.hygieneSuggestionsList(null);
  if (result.status === "error") {
    throw new Error(result.error);
  }
  return result.data;
}

export function useHygieneSuggestions(
  loader: () => Promise<HygieneSuggestionDto[]> = defaultLoader
): HygieneSuggestionsResult {
  const [suggestions, setSuggestions] = useState<HygieneSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loader()
      .then((dtos) => {
        if (!cancelled) {
          setSuggestions(dtos.map(mapHygieneSuggestion));
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load hygiene suggestions.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loader, retryCount]);

  const retry = useCallback(() => setRetryCount((c) => c + 1), []);

  return { suggestions, loading, error, partialFailures: [], retry };
}
