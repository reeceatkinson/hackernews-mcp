import { describe, expect, it } from "vitest";
import { formatItem, formatStoryList, formatUser } from "../src/hn/format";
import type { HnItem, HnUser } from "../src/hn/types";

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
