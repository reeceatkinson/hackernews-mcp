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

  it("returns 404 for the root path", async () => {
    const response = await worker.fetch(new Request("http://hackernews-mcp.test/"), env, ctx());
    expect(response.status).toBe(404);
  });

  it("returns 404 for unknown paths", async () => {
    const response = await worker.fetch(new Request("http://hackernews-mcp.test/nope"), env, ctx());
    expect(response.status).toBe(404);
  });
});
