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

const ID_RE = /\bwith id\s+(\S+)\b/i;

async function withClient(fn: (client: Client) => Promise<void>): Promise<void> {
  const mcp = createServer();
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await mcp.connect(serverSide);
  const client = new Client({ name: "explain-story-id-limit-test", version: "0.0.0" });
  await client.connect(clientSide);
  try {
    await fn(client);
  } finally {
    await client.close();
    await mcp.close();
  }
}

describe("hn_explain_story prompt id arg", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", hnFetchMock());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts ids in 1..MAX_ITEM_ID and emits them as a tool-call directive", async () => {
    await withClient(async (client) => {
      for (const id of ["1", "8863", "2147483647"]) {
        const result = await client.getPrompt({
          name: "hn_explain_story",
          arguments: { id },
        });
        const body = promptText(result);
        expect(body).toContain(`with id ${id}`);
        const match = body.match(ID_RE);
        expect(match).not.toBeNull();
        expect(match![1]).toBe(id);
      }
    });
  });

  it("rejects ids that fail the digit-format regex", async () => {
    await withClient(async (client) => {
      const rejected = ["99999999999", "-1", "abc", "1.5", " 7", "1e2", "", "7 "];
      for (const id of rejected) {
        await expect(
          client.getPrompt({ name: "hn_explain_story", arguments: { id } }),
        ).rejects.toThrow();
      }
    });
  });

  it("rejects regex-passing ids that fall outside the tool-supported 1..MAX_ITEM_ID range", async () => {
    await withClient(async (client) => {
      const rejected = ["0", "2147483648", "9999999999"];
      for (const id of rejected) {
        await expect(
          client.getPrompt({ name: "hn_explain_story", arguments: { id } }),
        ).rejects.toThrow();
      }
    });
  });

  it("drives an end-to-end hn_get_item round-trip for an accepted id (8863)", async () => {
    await withClient(async (client) => {
      const result = await client.getPrompt({
        name: "hn_explain_story",
        arguments: { id: "8863" },
      });
      const id = promptText(result).match(ID_RE)![1];
      expect(id).toBe("8863");

      const toolResult = await client.callTool({
        name: "hn_get_item",
        arguments: { id: 8863 },
      });
      expect(toolResult.isError).toBeFalsy();
      expect(toolText(toolResult)).toContain("My YC app: Dropbox");
    });
  });
});
