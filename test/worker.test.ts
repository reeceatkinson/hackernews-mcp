import { describe, expect, it } from "vitest";
import worker from "../src/index";

function ctx(): ExecutionContext {
  return {
    waitUntil() {},
    passThroughOnException() {},
    abort() {},
  } as unknown as ExecutionContext;
}

const env = {} as Env;

describe("worker routes", () => {
  it("serves a health check", async () => {
    const response = await worker.fetch(new Request("http://hackernews-mcp.test/health"), env, ctx());
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok\n");
  });

  it("serves a landing page with the MCP URL", async () => {
    const response = await worker.fetch(new Request("http://hackernews-mcp.test/"), env, ctx());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("http://hackernews-mcp.test/mcp");
    expect(html).toContain("hn_list_stories");
  });

  it("returns 404 for unknown paths", async () => {
    const response = await worker.fetch(new Request("http://hackernews-mcp.test/nope"), env, ctx());
    expect(response.status).toBe(404);
  });
});
