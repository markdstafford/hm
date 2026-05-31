export type PreviewComment = {
  id: string;
  authorDisplayName?: string | null;
  body?: string | null;
  createdAtSource?: string | null;
  updatedAtSource?: string | null;
  ingestedAt?: string | null;
};

export type PartitionedComments = {
  sorted: PreviewComment[];
  visible: PreviewComment[];
  hidden: PreviewComment[];
  total: number;
};

export function commentTimestamp(comment: PreviewComment): string | null {
  return comment.updatedAtSource ?? comment.createdAtSource ?? comment.ingestedAt ?? null;
}

function timestampMillis(comment: PreviewComment): number | null {
  const timestamp = commentTimestamp(comment);
  if (!timestamp) return null;
  const millis = Date.parse(timestamp);
  return Number.isNaN(millis) ? null : millis;
}

export function sortCommentsNewestFirst(comments: PreviewComment[]): PreviewComment[] {
  return comments
    .map((comment, index) => ({ comment, index, millis: timestampMillis(comment) }))
    .sort((a, b) => {
      if (a.millis !== null && b.millis !== null && a.millis !== b.millis) return b.millis - a.millis;
      if (a.millis !== null && b.millis === null) return -1;
      if (a.millis === null && b.millis !== null) return 1;
      return a.index - b.index;
    })
    .map((row) => row.comment);
}

export function partitionVisibleComments(comments: PreviewComment[], defaultVisibleCount = 2): PartitionedComments {
  const sorted = sortCommentsNewestFirst(comments);
  const visibleCount = Math.max(0, defaultVisibleCount);
  return {
    sorted,
    visible: sorted.slice(0, visibleCount),
    hidden: sorted.slice(visibleCount),
    total: sorted.length,
  };
}

export function commentAuthorLabel(comment: PreviewComment): string {
  const value = comment.authorDisplayName?.trim();
  return value && value.length > 0 ? value : "Unknown author";
}

export function commentBodyIsEmpty(comment: PreviewComment): boolean {
  return comment.body === null || comment.body === undefined || comment.body.trim().length === 0;
}
