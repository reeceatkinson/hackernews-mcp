import { describe, it, expect } from "vitest";
import { htmlToText } from "../src/hn/html";
import { formatCommentTree } from "../src/hn/format";

describe("htmlToText <pre>", () => {
  it("preserves a boolean expression inside <pre>", () => {
    const src = "<pre><code>if (a &lt; b &amp;&amp; c &gt; d) return;</code></pre>";
    expect(htmlToText(src).trim()).toBe("if (a < b && c > d) return;");
  });

  it("preserves generics inside <pre>", () => {
    const src = "<pre><code>var x: List&lt;string&gt; = [];</code></pre>";
    expect(htmlToText(src).trim()).toBe("var x: List<string> = [];");
  });

  it("does not rewrite an escaped anchor inside <pre> as a real link", () => {
    const src = "<pre><code>&lt;a href=\"https://x.com\"&gt;link&lt;/a&gt;</code></pre>";
    const out = htmlToText(src);
    expect(out).not.toContain("link (https://x.com)");
  });

  it("renders a real HN API comment text verbatim (item 7025871)", () => {
    const realText = "&gt; List comprehensions never seemed like a big deal to me. It&#x27;s 3-4 lines for a loop, which is probably easier to read than the list comprehension anyway.<p>that&#x27;s totally a nope.<p><pre><code>    def qsort(L):\n        if len(L) &lt;= 1: return L\n        return qsort([lt for lt in L[1:] if lt &lt; L[0]]) + [L[0]] + qsort([ge for ge in L[1:] if ge &gt;= L[0]])</code></pre>";
    const out = htmlToText(realText);
    expect(out).toContain("if len(L) <= 1: return L");
  });

  it("does not corrupt <pre> content from the Algolia search path (hn_search)", () => {
    const algolia = "I can see two legitimate cases for writing very short, very dense code.<p>1: Implement an algorithm in a very concise and straightforward, even if not very efficient, way. An example is the classic quicksort in Haskell, which most literally implements the idea of the algorithm:<p><pre><code>    qsort [] = []\n    qsort (p:xs) = qsort [ y | y &lt;- xs, y &lt; p ] ++ [p] ++\n                   qsort [ y | y &lt;- xs, y &gt;= p ]\n</code></pre>";
    const out = htmlToText(algolia);
    expect(out).toContain("y | y <- xs, y < p");
  });

  it("does not corrupt <pre> content end-to-end via formatCommentTree", () => {
    const story: any = { id: 7022900, title: "Another go at Go failed" };
    const comment: any = {
      id: 7025871,
      by: "baq",
      time: 1389209355,
      text: "&gt; List comprehensions never seemed like a big deal to me. It&#x27;s 3-4 lines for a loop, which is probably easier to read than the list comprehension anyway.<p>that&#x27;s totally a nope.<p><pre><code>    def qsort(L):\n        if len(L) &lt;= 1: return L\n        return qsort([lt for lt in L[1:] if lt &lt; L[0]]) + [L[0]] + qsort([ge for ge in L[1:] if ge &gt;= L[0]])</code></pre>",
    };

    const out = formatCommentTree(story, [{ item: comment, replies: [] }], false);
    expect(out).toContain("if len(L) <= 1: return L");
  });
});
