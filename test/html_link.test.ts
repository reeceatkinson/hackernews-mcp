import { describe, expect, it } from "vitest";
import { htmlToText } from "../src/hn/html";
import { formatSearch } from "../src/hn/format";

describe("htmlToText <a> link labels", () => {
  it("decodes link labels exactly once, matching the plain-text path", () => {
    // `&amp;lt;` single-decodes to `&lt;` on the plain path; the link label must match.
    expect(htmlToText("&amp;lt;")).toBe("&lt;");
    expect(htmlToText('<a href="https://e.com">&amp;lt;</a>')).toBe("&lt; (https://e.com)");
  });

  it("does not strip escaped angle brackets out of link labels", () => {
    // `&lt;foo&gt;` single-decodes to `<foo>`; the bug stripped this to "" inside a label.
    expect(htmlToText("&lt;foo&gt;")).toBe("<foo>");
    expect(htmlToText('<a href="https://e.com">&lt;foo&gt;</a>')).toBe("<foo> (https://e.com)");
  });

  it("decodes label and href to the same depth (no within-line inconsistency)", () => {
    // Real-data link fragment from HN item 788187. The label and href are the same
    // sequence; both must single-decode to `http://foo.com&#38;quot;&#38;gt`.
    const realLink =
      '<a href="http:&#x2F;&#x2F;foo.com&amp;#38;quot;&amp;#38;gt" rel="nofollow">http:&#x2F;&#x2F;foo.com&amp;#38;quot;&amp;#38;gt</a>';
    const out = htmlToText(realLink);
    expect(out).toBe("http://foo.com&#38;quot;&#38;gt (http://foo.com&#38;quot;&#38;gt)");
    const [label, href] = out.split(" (");
    expect(href?.slice(0, -1)).toBe(label);
  });

  it("keeps auto-linked bare URLs (label == href) single-decoded and consistent", () => {
    // No `&amp;` query-string separator is double-decoded (the trailing `;` rule).
    expect(
      htmlToText('<a href="https://e.com/watch?v=1&amp;list=2">https://e.com/watch?v=1&amp;list=2</a>'),
    ).toBe("https://e.com/watch?v=1&list=2 (https://e.com/watch?v=1&list=2)");
  });

  it("does not let an escaped anchor inside a label get stripped as a real tag", () => {
    // The label is the literal text `<a href="x">link</a>` (escaped); it must survive
    // as text, not be stripped by the global `<[^>]+>` pass.
    expect(htmlToText('<a href="https://e.com">&lt;a href="x"&gt;link&lt;/a&gt;</a>')).toBe(
      '<a href="x">link</a> (https://e.com)',
    );
  });
});

describe("link label entities end-to-end", () => {
  it("formatSearch preserves escaped angle brackets in Algolia comment_text links", () => {
    const result: any = {
      query: "generics",
      nbHits: 1,
      page: 0,
      hitsPerPage: 20,
      nbPages: 1,
      hits: [
        {
          objectID: "788187",
          _tags: ["comment"],
          title: null,
          story_title: "Generics discussion",
          author: "someone",
          points: 1,
          num_comments: 0,
          created_at: "2012-10-22T00:00:00.000Z",
          comment_text: 'See <a href="https://e.com">List&lt;T&gt; implementation</a> x',
        },
      ],
    };
    const out = formatSearch(result);
    expect(out).toContain("List<T> implementation (https://e.com)");
    expect(out).not.toContain("List implementation (https://e.com)");
  });
});
