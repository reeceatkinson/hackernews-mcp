import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createServer } from "../src/mcp";
import type { HnItem } from "../src/hn/types";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function text(content: unknown): string {
  if (typeof content !== "object" || content === null) return "";
  const block = content as { type?: string; text?: string };
  return block.type === "text" && typeof block.text === "string" ? block.text : "";
}

function toolText(result: { content: unknown }): string {
  return Array.isArray(result.content) ? result.content.map(text).join("\n") : text(result.content);
}

async function withClient(fn: (client: Client) => Promise<void>): Promise<void> {
  const mcp = createServer();
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await mcp.connect(serverSide);
  const client = new Client({ name: "user-submissions-test", version: "0.0.0" });
  await client.connect(clientSide);
  try {
    await fn(client);
  } finally {
    await client.close();
    await mcp.close();
  }
}

const ITEMS: Record<number, HnItem | null> = {
  10: { id: 10, type: "comment", by: "pg", text: "comment ten", time: 1000 },
  11: { id: 11, type: "comment", by: "pg", text: "comment eleven", time: 1100 },
  12: { id: 12, type: "story", by: "pg", title: "A real story submission", time: 1200, score: 10 },
  13: { id: 13, type: "comment", by: "pg", text: "comment thirteen", time: 1300 },
  14: { id: 14, type: "comment", by: "pg", text: "comment fourteen", time: 1400 },
  15: { id: 15, type: "poll", by: "pg", title: "A poll submission", time: 1500, parts: [] },
  16: { id: 16, type: "comment", by: "pg", text: "comment sixteen", time: 1600 },
  17: null,
  18: null,
  19: { id: 19, type: "comment", by: "pg", deleted: true, text: "deleted comment", time: 1900 },
  20: { id: 20, type: "story", by: "pg", title: "Another story", time: 2000, score: 5 },
  21: { id: 21, type: "job", by: "pg", title: "A job posting", time: 2100 },
};

function hnFetchMock(submitted: number[]): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/user/pg.json")) {
      return jsonResponse({ id: "pg", created: 1173923446, karma: 150000, submitted });
    }
    const match = url.match(/\/item\/(\d+)\.json$/);
    if (match) {
      const id = Number(match[1]);
      return jsonResponse(ITEMS[id] ?? null);
    }
    throw new Error(`unexpected fetch ${url}`);
  });
}

describe("hn_get_user submissions filtering", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", hnFetchMock([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]));
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("excludes comments, deleted items, and jobs — keeping only stories and polls", async () => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "hn_get_user",
        arguments: { username: "pg", include_submissions: true, submission_limit: 10 },
      });
      expect(result.isError).toBeFalsy();
      const body = toolText(result);

      expect(body).toContain("A real story submission");
      expect(body).toContain("A poll submission");
      expect(body).toContain("Another story");

      expect(body).not.toContain("comment ten");
      expect(body).not.toContain("comment eleven");
      expect(body).not.toContain("comment thirteen");
      expect(body).not.toContain("comment fourteen");
      expect(body).not.toContain("comment sixteen");
      expect(body).not.toContain("deleted comment");
      expect(body).not.toContain("A job posting");
    });
  });

  it("respects submission_limit and returns at most that many submissions", async () => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "hn_get_user",
        arguments: { username: "pg", include_submissions: true, submission_limit: 2 },
      });
      expect(result.isError).toBeFalsy();
      const body = toolText(result);

      expect(body).toContain("A real story submission");
      expect(body).toContain("A poll submission");
      expect(body).not.toContain("Another story");
    });
  });

  it("walks past comments to find enough submissions", async () => {
    vi.stubGlobal("fetch", hnFetchMock([10, 11, 13, 14, 16, 19, 12, 15, 20]));
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "hn_get_user",
        arguments: { username: "pg", include_submissions: true, submission_limit: 3 },
      });
      expect(result.isError).toBeFalsy();
      const body = toolText(result);

      expect(body).toContain("A real story submission");
      expect(body).toContain("A poll submission");
      expect(body).toContain("Another story");
    });
  });

  it("omits the recent activity section when the user has only comments", async () => {
    vi.stubGlobal("fetch", hnFetchMock([10, 11, 13]));
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "hn_get_user",
        arguments: { username: "pg", include_submissions: true, submission_limit: 10 },
      });
      expect(result.isError).toBeFalsy();
      const body = toolText(result);
      expect(body).not.toContain("Recent public activity");
      expect(body).toContain("Submitted items: 3");
    });
  });

  it("handles a user with no submitted array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/user/pg.json")) {
          return jsonResponse({ id: "pg", created: 1173923446, karma: 100 });
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "hn_get_user",
        arguments: { username: "pg", include_submissions: true, submission_limit: 10 },
      });
      expect(result.isError).toBeFalsy();
      const body = toolText(result);
      expect(body).toContain("Submitted items: 0");
      expect(body).not.toContain("Recent public activity");
    });
  });
});
