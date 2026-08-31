import { describe, expect, it } from "vitest";
import { htmlToText } from "../src/hn/html";

describe("htmlToText", () => {
  it("turns HN paragraphs and entities into readable text", () => {
    const input = "Aw shucks, guys ... you make me blush.<p>I&#x27;ll keep writing if you keep reading.";
    expect(htmlToText(input)).toBe("Aw shucks, guys ... you make me blush.\n\nI'll keep writing if you keep reading.");
  });

  it("keeps link URLs", () => {
    expect(htmlToText('See <a href="https://news.ycombinator.com">HN</a>')).toBe(
      "See HN (https://news.ycombinator.com)",
    );
  });

  it("drops javascript hrefs", () => {
    expect(htmlToText('Click <a href="javascript:alert(1)">here</a>')).toBe("Click here");
  });
});
