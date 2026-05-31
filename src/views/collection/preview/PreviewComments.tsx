import { useEffect, useId, useMemo, useState } from "react";
import { formatLocalDateTime } from "../../../lib/formatDateTime";
import { Markdown } from "../../../ui/text/Markdown";
import {
  commentAuthorLabel,
  commentBodyIsEmpty,
  commentTimestamp,
  partitionVisibleComments,
  type PreviewComment,
} from "./commentsModel";

type PreviewCommentsProps = {
  comments: PreviewComment[];
  resetKey?: string;
  defaultVisibleCount?: number;
};

export function PreviewComments({ comments, resetKey, defaultVisibleCount = 2 }: PreviewCommentsProps) {
  const headingId = useId();
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const partitioned = useMemo(
    () => partitionVisibleComments(comments, defaultVisibleCount),
    [comments, defaultVisibleCount],
  );

  useEffect(() => {
    setExpanded(false);
  }, [resetKey]);

  if (partitioned.total === 0) return null;

  const visibleComments = expanded ? partitioned.sorted : partitioned.visible;
  const canExpand = partitioned.total > defaultVisibleCount;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2 border-b border-border pb-3">
      <h3 id={headingId} className="text-sm font-medium text-text">
        Comments ({partitioned.total})
      </h3>

      <ol id={listId} aria-label="Comments" className="flex flex-col gap-3">
        {visibleComments.map((comment) => {
          const timestamp = commentTimestamp(comment);
          return (
            <li key={comment.id} className="flex flex-col gap-1 text-sm">
              <article aria-label={`Comment by ${commentAuthorLabel(comment)}`} className="flex flex-col gap-1">
                <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subtext">
                  <span className="font-medium text-text">{commentAuthorLabel(comment)}</span>
                  {timestamp && (
                    <>
                      <span aria-hidden="true">·</span>
                      <time dateTime={timestamp}>{formatLocalDateTime(timestamp)}</time>
                    </>
                  )}
                </header>
                {commentBodyIsEmpty(comment) ? (
                  <p className="text-sm text-subtext">No comment body</p>
                ) : (
                  <Markdown source={comment.body ?? ""} />
                )}
              </article>
            </li>
          );
        })}
      </ol>

      {canExpand && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex w-fit rounded px-1 py-0.5 text-xs font-medium text-subtext hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {expanded ? "Show fewer" : `Show all ${partitioned.total} comments`}
        </button>
      )}
    </section>
  );
}

export type { PreviewComment };
