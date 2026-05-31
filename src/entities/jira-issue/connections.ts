import type { JiraIssueListItem } from "../../bindings";
import type { CollectionEdge, CollectionEdgeKind } from "../../views/collection/navigation/types";

type FixtureSingleEdge = {
  id: string;
  kind: CollectionEdgeKind;
  shape: "single";
  relationship: string;
  targetKey: string;
  title?: string | null;
  confidence?: number;
};

type FixtureSetEdge = {
  id: string;
  kind: CollectionEdgeKind;
  shape: "set";
  relationship: string;
  label: string;
  targetKeys: string[];
  confidence?: number;
};

type JiraIssueWithFixtureEdges = JiraIssueListItem & {
  __hmFixtureEdges?: Array<FixtureSingleEdge | FixtureSetEdge>;
};

function byKey(items: JiraIssueListItem[]): Map<string, JiraIssueListItem> {
  return new Map(items.map((item) => [item.key, item]));
}

export function resolveJiraIssueEdges({
  item,
  allItems,
}: {
  item: JiraIssueListItem;
  allItems: JiraIssueListItem[];
}): CollectionEdge<JiraIssueListItem>[] {
  const fixtureEdges = (item as JiraIssueWithFixtureEdges).__hmFixtureEdges ?? [];
  if (fixtureEdges.length === 0) return [];

  const localByKey = byKey(allItems);

  return fixtureEdges.map((edge) => {
    if (edge.shape === "single") {
      const target = localByKey.get(edge.targetKey);
      return {
        id: edge.id,
        kind: edge.kind,
        shape: "single",
        relationship: edge.relationship,
        confidence: edge.confidence,
        targetRef: {
          entityId: "jira-issue",
          displayKey: edge.targetKey,
          title: target?.title ?? edge.title ?? null,
        },
        target,
        danglingReason: target ? undefined : ("not-ingested" as const),
      };
    }

    const totalCount = edge.targetKeys.length;
    const resolvedItems = edge.targetKeys
      .map((key) => localByKey.get(key))
      .filter((candidate): candidate is JiraIssueListItem => Boolean(candidate));
    const hasUnresolved = resolvedItems.length < totalCount;

    return {
      id: edge.id,
      kind: edge.kind,
      shape: "set",
      relationship: edge.relationship,
      label: edge.label,
      confidence: edge.confidence,
      count: totalCount,
      items: resolvedItems,
      danglingReason: hasUnresolved ? ("not-ingested" as const) : undefined,
    };
  });
}
