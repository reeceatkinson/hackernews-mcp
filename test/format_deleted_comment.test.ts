import { describe, expect, it } from "vitest";
import { formatCommentTree } from "../src/hn/format";
import type { CommentNode, HnItem } from "../src/hn/types";

const STORY: HnItem = { id: 49156683, type: "story", title: "Root story", kids: [49165870] };

describe("formatCommentTree — deleted comments", () => {
  it("walks the reply subtree under a deleted comment", () => {
    const tree: CommentNode[] = [
      {
        item: { id: 49165870, deleted: true, type: "comment", time: 1, kids: [49193564, 49171991], parent: 49156683 },
        replies: [
          {
            item: { id: 49193564, type: "comment", by: "ThePowerOfFuet", time: 2, text: "First live reply.", parent: 49165870 },
            replies: [],
          },
          {
            item: { id: 49171991, type: "comment", by: "zshrdlu", time: 3, kids: [49200001], text: "Second live reply.", parent: 49165870 },
            replies: [
              {
                item: { id: 49200001, type: "comment", by: "third", time: 4, text: "Nested reply.", parent: 49171991 },
                replies: [],
              },
            ],
          },
        ],
      },
    ];

    const out = formatCommentTree(STORY, tree, false);

    expect(out).toContain(`- [49165870] [deleted]`);
    expect(out).toContain(`  - [49193564] ThePowerOfFuet`);
    expect(out).toContain(`  - [49171991] zshrdlu`);
    expect(out).toContain(`    - [49200001] third`);
    expect(out).toContain("First live reply.");
    expect(out).toContain("Nested reply.");
  });

  it("renders [deleted] without author, time, or text for the deleted node itself", () => {
    const tree: CommentNode[] = [
      { item: { id: 49165870, deleted: true, type: "comment", time: 1, by: "ghost" }, replies: [] },
    ];
    const out = formatCommentTree(STORY, tree, false);
    const parentLine = out.split("\n").find((l) => l.includes("[49165870]"))!;
    expect(parentLine).toBe(`- [49165870] [deleted]`);
  });
});
