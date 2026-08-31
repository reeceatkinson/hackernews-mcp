import { describe, expect, it } from "vitest";
import { createServer } from "../src/mcp";

describe("createServer", () => {
  it("constructs an MCP server", () => {
    expect(createServer()).toBeTruthy();
  });
});
