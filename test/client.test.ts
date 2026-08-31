import { describe, expect, it, vi } from "vitest";
import { HnApiError, HnClient } from "../src/hn/client";
import type { HnItem } from "../src/hn/types";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("HnClient", () => {
  it("pages story IDs and hydrates items", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/topstories.json")) return jsonResponse([10, 20, 30, 40]);
      if (url.endsWith("/item/20.json")) {
        return jsonResponse({ id: 20, title: "Second", type: "story", score: 9 } satisfies HnItem);
      }
      if (url.endsWith("/item/30.json")) {
        return jsonResponse({ id: 30, title: "Third", type: "story", score: 4 } satisfies HnItem);
      }
      throw new Error(`unexpected url ${url}`);
    });

    const hn = new HnClient({ fetchImpl });
    const result = await hn.getStories("top", 2, 1);

    expect(result.total).toBe(4);
    expect(result.items.map((item) => item.id)).toEqual([20, 30]);
  });

  it("walks a comment tree with depth and count caps", async () => {
    const items: Record<number, HnItem> = {
      1: { id: 1, type: "story", title: "Root", kids: [2, 3] },
      2: { id: 2, type: "comment", by: "a", text: "first", kids: [4] },
      3: { id: 3, type: "comment", by: "b", text: "second" },
      4: { id: 4, type: "comment", by: "c", text: "nested" },
    };

    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const match = String(input).match(/\/item\/(\d+)\.json$/);
      if (!match) throw new Error(String(input));
      return jsonResponse(items[Number(match[1])]);
    });

    const hn = new HnClient({ fetchImpl });
    const shallow = await hn.getCommentTree(1, 1, 10);
    expect(shallow.tree.map((node) => node.item.id)).toEqual([2, 3]);
    expect(shallow.tree[0]?.replies).toEqual([]);
    expect(shallow.truncated).toBe(true);

    const deep = await hn.getCommentTree(1, 2, 10);
    expect(deep.tree[0]?.replies[0]?.item.id).toBe(4);
  });

  it("throws a typed error for missing users", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(null));
    const hn = new HnClient({ fetchImpl });
    await expect(hn.requireUser("nope")).rejects.toBeInstanceOf(HnApiError);
  });

  it("rejects usernames that would inject Algolia tags or path segments", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(null));
    const hn = new HnClient({ fetchImpl });
    await expect(hn.getUser("dang,story")).rejects.toBeInstanceOf(HnApiError);
    await expect(hn.getUser("../item/1")).rejects.toBeInstanceOf(HnApiError);
    await expect(hn.getUser("has space")).rejects.toBeInstanceOf(HnApiError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("builds Algolia search URLs", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.hostname).toBe("hn.algolia.com");
      expect(url.pathname).toBe("/api/v1/search_by_date");
      expect(url.searchParams.get("query")).toBe("dropbox");
      expect(url.searchParams.get("tags")).toBe("story");
      return jsonResponse({
        hits: [],
        page: 0,
        nbHits: 0,
        nbPages: 0,
        hitsPerPage: 20,
        query: "dropbox",
      });
    });

    const hn = new HnClient({ fetchImpl });
    await hn.search({ query: "dropbox", tags: "story", sort: "date" });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
