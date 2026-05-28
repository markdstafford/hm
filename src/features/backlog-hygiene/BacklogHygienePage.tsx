import { Breadcrumb } from "../../ui/navigation/Breadcrumb";
import { hygieneSuggestionEntity } from "../../entities/hygiene-suggestion";
import { useEntityCollectionViewer } from "../collection-viewer/useEntityCollectionViewer";
import { useHygieneSuggestions } from "./data";

type Props = { active: boolean };

export function BacklogHygienePage({ active }: Props) {
  const { suggestions, loading, error, partialFailures, retry } = useHygieneSuggestions();
  const viewer = useEntityCollectionViewer({
    active,
    entity: hygieneSuggestionEntity,
    items: suggestions,
    loading,
    error,
    partialFailures,
    retry,
    copy: {
      loadingLabel: "Loading hygiene suggestions",
      emptyTitle: "No suggestions yet",
      emptyDescription: "The triage engines have not produced any suggestions for this project. Suggestions appear here as the engines run.",
      errorTitle: "Could not load hygiene suggestions",
      errorDescription: "The hygiene suggestions could not be loaded. Try again after the local data source is available.",
    },
  });

  return {
    titleBar: <Breadcrumb items={[{ label: "Backlog hygiene", isCurrent: true }]} />,
    header: viewer.header,
    content: viewer.body,
  };
}
