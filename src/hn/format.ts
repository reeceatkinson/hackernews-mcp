import { HN_SITE } from "./types";
import type { AlgoliaHit, AlgoliaSearchResponse, CommentNode, HnItem, HnUser } from "./types";
import { htmlToText, safeHttpUrl } from "./html";

export function itemUrl(id: number): string {
  return `${HN_SITE}/item?id=${id}`;
}

export function userUrl(username: string): string {
  return `${HN_SITE}/user?id=${encodeURIComponent(username)}`;
}

export function formatUnix(time?: number): string {
  if (!time) return "unknown time";
  return new Date(time * 1000).toISOString().replace(".000Z", "Z");
}

export function formatItem(item: HnItem, extras?: { pollOptions?: HnItem[] }): string {
  if (item.deleted) {
    return `Item ${item.id} was deleted.\n${itemUrl(item.id)}`;
  }

  const lines: string[] = [];
  const kind = item.type ?? "item";
  const heading = item.title ? htmlToText(item.title) : `${kind} ${item.id}`;
  lines.push(`# ${heading}`);
  lines.push(`ID: ${item.id}`);
  lines.push(`Type: ${kind}`);
  if (item.dead) lines.push("Status: dead");
  if (item.by) lines.push(`Author: ${item.by} (${userUrl(item.by)})`);
  if (item.time) lines.push(`Posted: ${formatUnix(item.time)}`);
  if (typeof item.score === "number") lines.push(`Score: ${item.score}`);
  if (typeof item.descendants === "number") lines.push(`Comments: ${item.descendants}`);
  if (item.parent) lines.push(`Parent: ${item.parent} (${itemUrl(item.parent)})`);
  if (item.poll) lines.push(`Poll: ${item.poll} (${itemUrl(item.poll)})`);
  const url = safeHttpUrl(item.url);
  if (url) lines.push(`URL: ${url}`);
  lines.push(`HN: ${itemUrl(item.id)}`);

  if (item.text) {
    lines.push("", htmlToText(item.text));
  }

  if (extras?.pollOptions?.length) {
    lines.push("", "## Poll options");
    for (const option of extras.pollOptions) {
      const label = option.text ? htmlToText(option.text) : `option ${option.id}`;
      lines.push(`- (${option.score ?? 0}) ${label} [${option.id}]`);
    }
  }

  if (item.kids?.length) {
    lines.push("", `Child IDs (${item.kids.length}): ${item.kids.slice(0, 40).join(", ")}${item.kids.length > 40 ? ", …" : ""}`);
  }

  return lines.join("\n");
}

export function formatStoryList(
  feed: string,
  items: HnItem[],
  offset: number,
  total: number,
): string {
  if (!items.length) {
    return `No ${feed} stories found at offset ${offset}.`;
  }

  const lines = [
    `# Hacker News — ${feed} stories`,
    `Showing ${offset + 1}–${offset + items.length} of ${total}`,
    "",
  ];

  items.forEach((item, index) => {
    const rank = offset + index + 1;
    const title = item.title ? htmlToText(item.title) : `(${item.type ?? "item"} ${item.id})`;
    const meta = [
      item.score != null ? `${item.score} pts` : null,
      item.by ? `by ${item.by}` : null,
      item.descendants != null ? `${item.descendants} comments` : null,
      item.time ? formatUnix(item.time) : null,
    ]
      .filter(Boolean)
      .join(" · ");

    lines.push(`${rank}. ${title}`);
    if (meta) lines.push(`   ${meta}`);
    const url = safeHttpUrl(item.url);
    if (url) lines.push(`   ${url}`);
    lines.push(`   ${itemUrl(item.id)}`);
    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

export function formatUser(user: HnUser, recent?: HnItem[]): string {
  const lines = [
    `# ${user.id}`,
    `Karma: ${user.karma}`,
    `Created: ${formatUnix(user.created)}`,
    `Profile: ${userUrl(user.id)}`,
    `Submissions: ${user.submitted?.length ?? 0}`,
  ];

  if (user.about) {
    lines.push("", htmlToText(user.about));
  }

  if (recent?.length) {
    lines.push("", "## Recent public activity");
    for (const item of recent) {
      const label = item.title
        ? htmlToText(item.title)
        : item.text
          ? truncate(htmlToText(item.text), 140)
          : `${item.type ?? "item"} ${item.id}`;
      lines.push(`- [${item.id}] (${item.type ?? "item"}) ${label}`);
      lines.push(`  ${itemUrl(item.id)}`);
    }
  }

  return lines.join("\n");
}

export function formatCommentTree(root: HnItem, tree: CommentNode[], truncated: boolean): string {
  const header = root.title
    ? `# Comments on: ${htmlToText(root.title)}`
    : `# Comments on item ${root.id}`;
  const lines = [header, `HN: ${itemUrl(root.id)}`, ""];

  if (!tree.length) {
    lines.push("No comments returned.");
    return lines.join("\n");
  }

  const walk = (nodes: CommentNode[], depth: number) => {
    for (const node of nodes) {
      const indent = "  ".repeat(depth);
      const item = node.item;
      if (item.deleted) {
        lines.push(`${indent}- [${item.id}] [deleted]`);
        continue;
      }
      const author = item.by ?? "unknown";
      const when = formatUnix(item.time);
      lines.push(`${indent}- [${item.id}] ${author} · ${when}`);
      if (item.dead) lines.push(`${indent}  [dead]`);
      if (item.text) {
        for (const paragraph of htmlToText(item.text).split("\n")) {
          lines.push(`${indent}  ${paragraph}`);
        }
      }
      if (node.replies.length) walk(node.replies, depth + 1);
    }
  };

  walk(tree, 0);
  if (truncated) {
    lines.push("", "Comment tree was truncated by max_comments / max_depth.");
  }
  return lines.join("\n");
}

export function formatSearch(result: AlgoliaSearchResponse): string {
  const lines = [
    `# Search: ${result.query || "(empty)"}`,
    `${result.nbHits} hits · page ${result.page + 1}/${Math.max(result.nbPages, 1)}`,
    "",
  ];

  if (!result.hits.length) {
    lines.push("No results.");
    return lines.join("\n");
  }

  result.hits.forEach((hit, index) => {
    lines.push(`${index + 1}. ${formatHit(hit)}`);
    lines.push("");
  });

  return lines.join("\n").trimEnd();
}

function formatHit(hit: AlgoliaHit): string {
  const id = hit.objectID;
  const isComment = hit._tags?.includes("comment") || Boolean(hit.comment_text);
  const title = hit.title
    ? htmlToText(hit.title)
    : hit.story_title
      ? `Comment on: ${htmlToText(hit.story_title)}`
      : `${isComment ? "Comment" : "Item"} ${id}`;
  const meta = [
    hit.points != null ? `${hit.points} pts` : null,
    hit.author ? `by ${hit.author}` : null,
    hit.num_comments != null ? `${hit.num_comments} comments` : null,
    hit.created_at ?? null,
  ]
    .filter(Boolean)
    .join(" · ");

  const parts = [title, `   ${meta}`, `   ${itemUrl(Number(id))}`];
  const url = safeHttpUrl(hit.url);
  if (url) parts.push(`   ${url}`);
  if (hit.comment_text) parts.push(`   ${truncate(htmlToText(hit.comment_text), 280)}`);
  return parts.join("\n");
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
