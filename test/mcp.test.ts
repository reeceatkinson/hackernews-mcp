import { describe, expect, it } from "vitest";
import { createServer } from "../src/mcp";
import { isHnUsername, parseItemId } from "../src/hn/types";

describe("createServer", () => {
  it("constructs an MCP server", () => {
    expect(createServer()).toBeTruthy();
  });
});

describe("input bounds", () => {
  it("parses item ids as whole decimal integers", () => {
    expect(parseItemId(8863)).toBe(8863);
    expect(parseItemId("8863")).toBe(8863);
    expect(parseItemId("1e2")).toBeNull();
    expect(parseItemId(0)).toBeNull();
    expect(parseItemId(-1)).toBeNull();
  });

  it("rejects usernames that would break Algolia tag syntax", () => {
    expect(isHnUsername("dang")).toBe(true);
    expect(isHnUsername("dang,story")).toBe(false);
    expect(isHnUsername("a/b")).toBe(false);
  });
});
