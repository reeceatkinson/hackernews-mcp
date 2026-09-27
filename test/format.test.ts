import { describe, expect, it } from "vitest";
import { formatItem, formatSearch, formatStoryList, formatUser } from "../src/hn/format";
import type { AlgoliaHit, AlgoliaSearchResponse, HnItem, HnUser } from "../src/hn/types";

const dropbox: HnItem = {
  by: "dhouston",
  descendants: 71,
  id: 8863,
  kids: [8952, 9224],
  score: 111,
  time: 1175714200,
  title: "My YC app: Dropbox - Throw away your USB drive",
  type: "story",
  url: "http://www.getdropbox.com/u/2/screencast.html",
};

describe("formatItem", () => {
  it("includes title, score, and HN permalink", () => {
    const text = formatItem(dropbox);
    expect(text).toContain("# My YC app: Dropbox - Throw away your USB drive");
    expect(text).toContain("Score: 111");
    expect(text).toContain("https://news.ycombinator.com/item?id=8863");
    expect(text).toContain("http://www.getdropbox.com/u/2/screencast.html");
  });

  it("marks deleted items", () => {
    expect(formatItem({ id: 1, deleted: true })).toContain("was deleted");
  });

  it("omits non-http item URLs", () => {
    const text = formatItem({
      id: 2,
      type: "story",
      title: "Nope",
      url: "javascript:alert(1)",
    });
    expect(text).not.toContain("javascript:");
    expect(text).not.toContain("URL:");
  });
});

describe("formatStoryList", () => {
  it("ranks stories from the requested offset", () => {
    const text = formatStoryList("top", [dropbox], 10, 500);
    expect(text).toContain("Showing 11–11 of 500");
    expect(text).toContain("11. My YC app: Dropbox");
  });
});

describe("formatUser", () => {
  it("renders karma and about HTML", () => {
    const user: HnUser = {
      id: "jl",
      created: 1173923446,
      karma: 2937,
      about: "This is a test",
      submitted: [1, 2, 3],
    };
    const text = formatUser(user);
    expect(text).toContain("Karma: 2937");
    expect(text).toContain("Submissions: 3");
    expect(text).toContain("This is a test");
  });
});

function searchHit(objectID: number): AlgoliaHit {
  return {
    objectID: String(objectID),
    title: `Result ${objectID}`,
    author: "alice",
    points: 10,
    num_comments: 1,
    created_at: "2024-01-01T00:00:00.000Z",
  };
}

function searchPage(
  pageNum: number,
  hitsPerPage: number,
  hits: AlgoliaHit[],
  nbHits = 60,
  nbPages = 3,
  query = "test",
): AlgoliaSearchResponse {
  return { hits, page: pageNum, nbHits, nbPages, hitsPerPage, query };
}

function hitsRange(start: number, count: number): AlgoliaHit[] {
  return Array.from({ length: count }, (_, i) => searchHit(start + i));
}

describe("formatSearch", () => {
  it("numbers page 0 starting at 1", () => {
    const text = formatSearch(searchPage(0, 20, hitsRange(1, 20)));
    expect(text).toContain("page 1/3");
    expect(text).toMatch(/^1\. Result 1$/m);
    expect(text).toMatch(/^20\. Result 20$/m);
    expect(text).not.toMatch(/^21\. /m);
  });

  it("continues the global rank across pages (page 1, full page)", () => {
    const text = formatSearch(searchPage(1, 20, hitsRange(21, 20)));
    expect(text).toContain("page 2/3");
    expect(text).toMatch(/^21\. Result 21$/m);
    expect(text).toMatch(/^40\. Result 40$/m);
    expect(text).not.toMatch(/^1\. Result 21$/m);
    expect(text).not.toMatch(/^20\. Result 40$/m);
  });

  it("continues the global rank onto a partial last page using hitsPerPage as the stride", () => {
    const text = formatSearch(searchPage(1, 20, hitsRange(21, 5)));
    expect(text).toContain("page 2/3");
    expect(text).toMatch(/^21\. Result 21$/m);
    expect(text).toMatch(/^25\. Result 25$/m);
    expect(text).not.toMatch(/^1\. /m);
    expect(text).not.toMatch(/^26\. /m);
  });
});
