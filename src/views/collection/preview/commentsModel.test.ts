import { describe, expect, it } from "vitest";
import {
  commentAuthorLabel,
  commentBodyIsEmpty,
  commentTimestamp,
  partitionVisibleComments,
  sortCommentsNewestFirst,
  type PreviewComment,
} from "./commentsModel";

const comment = (overrides: Partial<PreviewComment>): PreviewComment => ({
  id: overrides.id ?? "comment",
  authorDisplayName: overrides.authorDisplayName ?? "Author",
  body: overrides.body ?? "Body",
  createdAtSource: overrides.createdAtSource ?? null,
  updatedAtSource: overrides.updatedAtSource ?? null,
  ingestedAt: overrides.ingestedAt ?? null,
});

describe("commentsModel", () => {
  it("sorts newest first by updated, then created, then ingested timestamp", () => {
    const sorted = sortCommentsNewestFirst([
      comment({ id: "old-created", createdAtSource: "2026-05-28T10:00:00Z" }),
      comment({ id: "new-updated", createdAtSource: "2026-05-01T10:00:00Z", updatedAtSource: "2026-05-31T10:00:00Z" }),
      comment({ id: "middle-created", createdAtSource: "2026-05-30T10:00:00Z" }),
      comment({ id: "ingested", ingestedAt: "2026-05-29T10:00:00Z", createdAtSource: null }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["new-updated", "middle-created", "ingested", "old-created"]);
  });

  it("uses deterministic original order for tied or missing timestamps", () => {
    const sorted = sortCommentsNewestFirst([
      comment({ id: "first", createdAtSource: null, updatedAtSource: null, ingestedAt: null }),
      comment({ id: "second", createdAtSource: null, updatedAtSource: null, ingestedAt: null }),
      comment({ id: "third", createdAtSource: "bad-date", updatedAtSource: null, ingestedAt: null }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["first", "second", "third"]);
  });

  it("partitions visible and hidden comments after sorting", () => {
    const result = partitionVisibleComments(
      [
        comment({ id: "one", updatedAtSource: "2026-05-31T10:00:00Z" }),
        comment({ id: "two", updatedAtSource: "2026-05-30T10:00:00Z" }),
        comment({ id: "three", updatedAtSource: "2026-05-29T10:00:00Z" }),
      ],
      2,
    );

    expect(result.visible.map((item) => item.id)).toEqual(["one", "two"]);
    expect(result.hidden.map((item) => item.id)).toEqual(["three"]);
    expect(result.total).toBe(3);
  });

  it("returns author, timestamp, and body fallbacks", () => {
    const item = comment({
      authorDisplayName: "  ",
      body: "  ",
      updatedAtSource: null,
      createdAtSource: "2026-05-30T10:00:00Z",
      ingestedAt: "2026-05-31T10:00:00Z",
    });

    expect(commentAuthorLabel(item)).toBe("Unknown author");
    expect(commentTimestamp(item)).toBe("2026-05-30T10:00:00Z");
    expect(commentBodyIsEmpty(item)).toBe(true);
  });
});
