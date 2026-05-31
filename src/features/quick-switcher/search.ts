import type { QuickSwitcherMatchKind, QuickSwitcherResult, QuickSwitcherSource } from "./types";

const SCORE: Record<QuickSwitcherMatchKind, number> = {
  exact: 600,
  prefix: 500,
  "title-word-prefix": 400,
  "title-substring": 300,
  "context-substring": 200,
  default: 0,
};

function stripEdgePunctuation(value: string): string {
  return value.replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, "");
}

export function normalizeQuickSwitcherQuery(value: string): string {
  return stripEdgePunctuation(value).toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function normalizedFields(values: readonly (string | null | undefined)[]): string[] {
  return values
    .map((value) => normalizeQuickSwitcherQuery(value ?? ""))
    .filter((value) => value.length > 0);
}

function titleWords(title: string): string[] {
  return normalizeQuickSwitcherQuery(title).split(/[\s/_:;,.()[\]{}-]+/).filter(Boolean);
}

function classifyMatch<TItem>(
  item: ReturnType<QuickSwitcherSource<TItem>["toQuickSwitcherItem"]>,
  query: string,
): { kind: QuickSwitcherMatchKind; field: string | null } | null {
  const exactFields = normalizedFields([item.primaryLabel, ...(item.rankBoosts?.exact ?? [])]);
  const prefixFields = normalizedFields([item.primaryLabel, ...(item.rankBoosts?.prefix ?? [])]);
  const title = normalizeQuickSwitcherQuery(item.title);
  const contextFields = normalizedFields([item.contextLabel, item.statusLabel, ...item.searchableText]);

  if (exactFields.some((field) => field === query)) return { kind: "exact", field: item.primaryLabel };
  if (prefixFields.some((field) => field.startsWith(query))) return { kind: "prefix", field: item.primaryLabel };
  if (titleWords(item.title).some((word) => word.startsWith(query))) return { kind: "title-word-prefix", field: item.title };
  if (title.includes(query)) return { kind: "title-substring", field: item.title };
  if (contextFields.some((field) => field.includes(query))) return { kind: "context-substring", field: null };
  return null;
}

export function buildQuickSwitcherResults({
  sources,
  query,
  limit = 50,
}: {
  sources: QuickSwitcherSource[];
  query: string;
  limit?: number;
}): QuickSwitcherResult[] {
  const normalizedQuery = normalizeQuickSwitcherQuery(query);
  const results: QuickSwitcherResult[] = [];

  sources.forEach((source, sourceIndex) => {
    source.items.forEach((rawItem, itemIndex) => {
      const item = source.toQuickSwitcherItem(rawItem);
      if (!normalizedQuery) {
        results.push({
          id: `${source.id}:${item.id}`,
          source,
          item,
          sourceIndex,
          itemIndex,
          score: SCORE.default,
          match: { kind: "default", field: null },
        });
        return;
      }

      const match = classifyMatch(item, normalizedQuery);
      if (!match) return;
      results.push({
        id: `${source.id}:${item.id}`,
        source,
        item,
        sourceIndex,
        itemIndex,
        score: SCORE[match.kind],
        match,
      });
    });
  });

  return results
    .sort((a, b) =>
      b.score - a.score ||
      a.sourceIndex - b.sourceIndex ||
      a.itemIndex - b.itemIndex ||
      a.item.primaryLabel.localeCompare(b.item.primaryLabel),
    )
    .slice(0, limit);
}
