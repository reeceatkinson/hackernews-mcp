import { describe, expect, it } from "vitest";
import { landingPage } from "../src/landing";
import { createServer } from "../src/mcp";

describe("createServer", () => {
  it("constructs an MCP server", () => {
    expect(createServer()).toBeTruthy();
  });
});

describe("landingPage", () => {
  it("embeds the MCP URL for the current origin", () => {
    const html = landingPage("https://hackernews-mcp.example.workers.dev");
    expect(html).toContain("https://hackernews-mcp.example.workers.dev/mcp");
    expect(html).toContain("hn_list_stories");
  });
});
