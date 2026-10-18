import { describe, expect, it } from "vitest";
import { titleToText } from "../src/hn/html";
import { formatCommentTree, formatItem, formatSearch, formatStoryList, formatUser } from "../src/hn/format";
import type { AlgoliaSearchResponse, HnItem, HnUser } from "../src/hn/types";

describe("titleToText", () => {
  it("preserves raw angle brackets in a plain-text title", () => {
    // `htmlToText` would strip `<T>` as if it were a tag; titles are plain text.
    expect(titleToText("List<T> implementation notes")).toBe("List<T> implementation notes");
  });

  it("decodes HTML-escaped titles to the characters HN displays", () => {
    // Both Firebase and Algolia return item 1490069 escaped this way; HN renders
    // it as `The Origin of the <blink> Tag`, so entity decoding must stay.
    expect(titleToText("The Origin of the &lt;blink&gt; Tag")).toBe("The Origin of the <blink> Tag");
  });
});

describe("titles end-to-end", () => {
  it("formatItem preserves raw brackets in the heading and still strips HTML in the body", () => {
    // Guards the split between `titleToText` (plain text) and `htmlToText` (HTML):
    // the title keeps `<T>` while the body has `<p>`/`<code>` stripped and
    // entities decoded.
    const item: HnItem = {
      id: 1,
      type: "story",
      title: "List<T> implementation notes",
      text: "What <p>is the use of <code>List&lt;T&gt;</code>?</p>",
    };
    const out = formatItem(item);
    expect(out).toContain("# List<T> implementation notes");
    expect(out).not.toContain("# List implementation notes");
    expect(out).toContain("List<T>");
    expect(out).not.toContain("<p>");
    expect(out).not.toContain("<code>");
  });

  it("formatStoryList preserves raw brackets in list entries", () => {
    const items: HnItem[] = [
      { id: 1, type: "story", title: "List<T> implementation notes", score: 1, by: "a" },
    ];
    const out = formatStoryList("top", items, 0, 1);
    expect(out).toContain("1. List<T> implementation notes");
    expect(out).not.toMatch(/^1\. List implementation notes$/m);
  });

  it("formatUser preserves raw brackets in recent activity labels", () => {
    const user: HnUser = { id: "u", created: 1, karma: 0, submitted: [] };
    const recent: HnItem[] = [
      { id: 1, type: "story", title: "List<T> implementation notes" },
    ];
    const out = formatUser(user, recent);
    expect(out).toContain("List<T> implementation notes");
    expect(out).not.toContain("List implementation notes");
  });

  it("formatCommentTree preserves raw brackets in the header", () => {
    const root: HnItem = { id: 1, type: "story", title: "List<T> implementation notes" };
    const out = formatCommentTree(root, [], false);
    expect(out).toContain("# Comments on: List<T> implementation notes");
    expect(out).not.toContain("# Comments on: List implementation notes");
  });

  it("formatSearch preserves raw brackets in story hits", () => {
    const result: AlgoliaSearchResponse = {
      query: "generics",
      page: 0,
      nbHits: 1,
      nbPages: 1,
      hitsPerPage: 20,
      hits: [
        {
          objectID: "1",
          title: "List<T> implementation notes",
          author: "a",
          points: 1,
          num_comments: 0,
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    };
    const out = formatSearch(result);
    expect(out).toContain("1. List<T> implementation notes");
    expect(out).not.toMatch(/^1\. List implementation notes$/m);
  });

  it("formatSearch preserves raw brackets in comment-on story titles", () => {
    const result: AlgoliaSearchResponse = {
      query: "generics",
      page: 0,
      nbHits: 1,
      nbPages: 1,
      hitsPerPage: 20,
      hits: [
        {
          objectID: "2",
          _tags: ["comment"],
          title: null,
          story_title: "List<T> implementation notes",
          author: "a",
          points: 1,
          num_comments: 0,
          created_at: "2024-01-01T00:00:00.000Z",
          comment_text: "great post",
        },
      ],
    };
    const out = formatSearch(result);
    expect(out).toContain("Comment on: List<T> implementation notes");
    expect(out).not.toContain("Comment on: List implementation notes");
  });
});
