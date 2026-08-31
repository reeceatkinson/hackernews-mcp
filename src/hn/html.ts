const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const MAX_HTML_CHARS = 100_000;

/** http(s) only — HN/Algolia fields are displayed, never fetched. */
export function safeHttpUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return url;
  } catch {
    return undefined;
  }
  return undefined;
}

/** Convert HN HTML (comments/about/Ask text) into readable plain text. */
export function htmlToText(input: string): string {
  const source = input.length > MAX_HTML_CHARS ? input.slice(0, MAX_HTML_CHARS) : input;
  const withoutTags = source
    .replace(/<\s*p\s*>/gi, "\n\n")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*p\s*>/gi, "")
    .replace(/<\s*pre\s*>[\s\S]*?<\s*\/\s*pre\s*>/gi, (block) => {
      const inner = block.replace(/<\s*\/?pre\s*>/gi, "").replace(/<\s*\/?code\s*>/gi, "");
      return `\n${decodeEntities(inner)}\n`;
    })
    .replace(/<\s*a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\s*\/\s*a\s*>/gi, (_m, href, label) => {
      const text = decodeEntities(String(label).replace(/<[^>]+>/g, "")).trim();
      const safe = safeHttpUrl(String(href));
      if (!safe) return text;
      return text && text !== safe ? `${text} (${safe})` : safe;
    })
    .replace(/<[^>]+>/g, "");

  return decodeEntities(withoutTags)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const hex = entity[1] === "x" || entity[1] === "X";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (Number.isFinite(code) && code > 0) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return match;
        }
      }
      return match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}
