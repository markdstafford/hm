import type { HygieneSuggestion } from "../../entities/hygiene-suggestion/types";
import { HYGIENE_SUGGESTION_FIXTURE } from "./fixture";

export type HygieneSuggestionsResult = {
  suggestions: HygieneSuggestion[];
  loading: boolean;
  error: string | null;
  partialFailures: { source: string; message: string }[];
  retry?: () => void;
};

export function useHygieneSuggestions(): HygieneSuggestionsResult {
  return {
    suggestions: HYGIENE_SUGGESTION_FIXTURE,
    loading: false,
    error: null,
    partialFailures: [],
  };
}
