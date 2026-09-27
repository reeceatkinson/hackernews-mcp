import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createServer } from "../src/mcp";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function hnFetchMock(): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/topstories.json")) return jsonResponse([8863]);
    if (url.endsWith("/item/8863.json")) {
      return jsonResponse({
        id: 8863,
        type: "story",
        by: "dhouston",
        score: 111,
        time: 1175714200,
        title: "My YC app: Dropbox - Throw away your USB drive",
        url: "http://www.getdropbox.com/u/2/screencast.html",
        descendants: 71,
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
}

function text(content: unknown): string {
  if (typeof content !== "object" || content === null) return "";
  const block = content as { type?: string; text?: string };
  return block.type === "text" && typeof block.text === "string" ? block.text : "";
}

function promptText(result: { messages: Array<{ content: unknown }> }): string {
  return result.messages.map((m) => text(m.content)).join("\n");
}

function toolText(result: { content: unknown }): string {
  return Array.isArray(result.content) ? result.content.map(text).join("\n") : text(result.content);
}

const LIMIT_RE = /\blimit\s+(\d+)\b/i;

async function withClient(fn: (client: Client) => Promise<void>): Promise<void> {
  const mcp = createServer();
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await mcp.connect(serverSide);
  const client = new Client({ name: "front-page-limit-test", version: "0.0.0" });
  await client.connect(clientSide);
  try {
    await fn(client);
  } finally {
    await client.close();
    await mcp.close();
  }
}

describe("hn_front_page prompt count arg", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", hnFetchMock());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts 1..50 and emits a limit inside the hn_list_stories valid range", async () => {
    await withClient(async (client) => {
      for (const count of ["1", "9", "10", "15", "49", "50"]) {
        const result = await client.getPrompt({
          name: "hn_front_page",
          arguments: { count },
        });
        const body = promptText(result);
        expect(body).toContain(`limit ${count}`);
        const match = body.match(LIMIT_RE);
        expect(match).not.toBeNull();
        const limit = Number(match![1]);
        expect(limit).toBeGreaterThanOrEqual(1);
        expect(limit).toBeLessThanOrEqual(50);
      }
    });
  });

  it("defaults to limit 15 when count is omitted", async () => {
    await withClient(async (client) => {
      const result = await client.getPrompt({
        name: "hn_front_page",
        arguments: {},
      });
      const body = promptText(result);
      expect(body).toContain("limit 15");
      expect(Number(body.match(LIMIT_RE)![1])).toBe(15);
    });
  });

  it("rejects counts that exceed the tool's limit cap (51..99 were the bug; also 0, 100, and non-numeric)", async () => {
    await withClient(async (client) => {
      const rejected = ["0", "51", "75", "99", "100", "-1", "abc", "5x", "1.5", " 7"];
      for (const count of rejected) {
        await expect(
          client.getPrompt({ name: "hn_front_page", arguments: { count } }),
        ).rejects.toThrow();
      }
    });
  });

  it("drives an end-to-end hn_list_stories round-trip for the highest accepted count (50)", async () => {
    await withClient(async (client) => {
      const result = await client.getPrompt({
        name: "hn_front_page",
        arguments: { count: "50" },
      });
      const limit = Number(promptText(result).match(LIMIT_RE)![1]);
      expect(limit).toBe(50);

      const toolResult = await client.callTool({
        name: "hn_list_stories",
        arguments: { feed: "top", limit },
      });
      expect(toolResult.isError).toBeFalsy();
      expect(toolText(toolResult)).toContain("My YC app: Dropbox");
    });
  });

  it("still anchors the prompt's upper bound by rejecting limit > 50 in hn_list_stories", async () => {
    await withClient(async (client) => {
      const toolResult = await client.callTool({
        name: "hn_list_stories",
        arguments: { feed: "top", limit: 51 },
      });
      expect(toolResult.isError).toBe(true);
      const body = toolText(toolResult);
      expect(body.toLowerCase()).toContain("limit");
      expect(body).toContain("hn_list_stories");
    });
  });
});
