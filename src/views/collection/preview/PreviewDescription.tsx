import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Markdown } from "../../../ui/text/Markdown";
import { isEmptyPreviewBody } from "./descriptionModel";

type PreviewDescriptionProps = {
  body: string | null | undefined;
  resetKey?: string;
  collapsedLines?: number;
};

const DEFAULT_COLLAPSED_LINES = 8;
const LINE_HEIGHT_REM = 1.5;

export function PreviewDescription({
  body,
  resetKey,
  collapsedLines = DEFAULT_COLLAPSED_LINES,
}: PreviewDescriptionProps) {
  const headingId = useId();
  const contentId = useId();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const empty = isEmptyPreviewBody(body);

  const measureOverflow = useCallback(() => {
    const node = contentRef.current;
    if (!node || empty || expanded) return;
    setIsOverflowing(node.scrollHeight > node.clientHeight + 1);
  }, [empty, expanded]);

  useEffect(() => {
    setExpanded(false);
    setIsOverflowing(false);
  }, [resetKey, body]);

  useEffect(() => {
    if (empty) return;
    measureOverflow();

    const node = contentRef.current;
    if (!node) return;

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => measureOverflow());
      observer.observe(node);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", measureOverflow);
    return () => window.removeEventListener("resize", measureOverflow);
  }, [empty, measureOverflow, body, collapsedLines]);

  const maxHeight = `${collapsedLines * LINE_HEIGHT_REM}rem`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2 border-b border-border pb-3">
      <h3 id={headingId} className="text-sm font-medium text-text">
        Description
      </h3>

      {empty ? (
        <p className="text-sm text-subtext">No description</p>
      ) : (
        <>
          <div
            id={contentId}
            ref={contentRef}
            className={expanded ? "" : "overflow-hidden"}
            style={expanded ? undefined : { maxHeight }}
          >
            <Markdown source={body ?? ""} />
          </div>

          {(isOverflowing || expanded) && (
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={contentId}
              onClick={() => setExpanded((value) => !value)}
              className="inline-flex w-fit rounded px-1 py-0.5 text-xs font-medium text-subtext hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
