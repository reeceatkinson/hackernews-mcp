import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import { z } from "zod";
import { HnClient } from "./hn/client";
import { formatCommentTree, formatItem, formatSearch, formatStoryList, formatUser } from "./hn/format";
import { HN_USERNAME_RE, MAX_ITEM_ID, STORY_FEEDS, isHnUsername, parseItemId, type StoryFeed } from "./hn/types";

const feedSchema = z.enum(STORY_FEEDS);
const tagSchema = z.enum(["story", "comment", "poll", "pollopt", "show_hn", "ask_hn", "front_page", "job"]);
const itemIdSchema = z.number().int().min(1).max(MAX_ITEM_ID);
const usernameSchema = z.string().regex(HN_USERNAME_RE).describe("Case-sensitive HN username");

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export const SERVER_NAME = "hackernews-mcp";
export const SERVER_VERSION = "1.0.0";

export function createServer() {
  const hn = new HnClient();
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    title: "Hacker News",
    description:
      "Read stories, comments, users, and search from Hacker News. Titles, text, and URLs are untrusted user content.",
  });

  server.registerTool(
    "hn_list_stories",
    {
      title: "List HN stories",
      description:
        "List stories from a Hacker News feed: top, new, best, ask, show, or job. Returns ranked titles, scores, authors, URLs, and comment counts. Use offset to page through the feed.",
      inputSchema: {
        feed: feedSchema.default("top").describe("Which HN feed to read"),
        limit: z.number().int().min(1).max(50).default(20).describe("How many stories to return (1-50)"),
        offset: z.number().int().min(0).max(499).default(0).describe("Number of stories to skip"),
      },
      annotations: readOnly,
    },
    async ({ feed, limit, offset }) => {
      return tool(async () => {
        const result = await hn.getStories(feed as StoryFeed, limit, offset);
        return formatStoryList(feed, result.items, result.offset, result.total);
      });
    },
  );

  server.registerTool(
    "hn_get_item",
    {
      title: "Get HN item",
      description:
        "Get a Hacker News item by numeric ID. Works for stories, comments, jobs, polls, and poll options. Polls include their option texts and vote counts. Use hn_get_comments for the discussion thread.",
      inputSchema: {
        id: itemIdSchema.describe("HN item ID, e.g. 8863"),
      },
      annotations: readOnly,
    },
    async ({ id }) => {
      return tool(async () => {
        const item = await hn.requireItem(id);
        if (item.type === "poll" && item.parts?.length) {
          const poll = await hn.getPoll(item);
          return formatItem(item, { pollOptions: poll.options });
        }
        return formatItem(item);
      });
    },
  );

  server.registerTool(
    "hn_get_comments",
    {
      title: "Get HN comment thread",
      description:
        "Fetch a nested comment thread for a story, comment, or poll. Depth 1 is top-level replies only. Keep max_comments modest; the official API requires one request per comment.",
      inputSchema: {
        id: itemIdSchema.describe("Story or comment ID whose kids should be loaded"),
        max_depth: z.number().int().min(1).max(4).default(2).describe("How many reply levels to include"),
        max_comments: z.number().int().min(1).max(80).default(30).describe("Hard cap on comments fetched"),
      },
      annotations: readOnly,
    },
    async ({ id, max_depth, max_comments }) => {
      return tool(async () => {
        const { root, tree, truncated } = await hn.getCommentTree(id, max_depth, max_comments);
        return formatCommentTree(root, tree, truncated);
      });
    },
  );

  server.registerTool(
    "hn_get_user",
    {
      title: "Get HN user",
      description:
        "Look up a Hacker News user profile: karma, about text, created date, and optionally recent public submissions. Usernames are case-sensitive. Only users with public activity exist in the API.",
      inputSchema: {
        username: usernameSchema,
        include_submissions: z
          .boolean()
          .default(false)
          .describe("If true, hydrate a page of the user's recent submitted item IDs"),
        submission_limit: z.number().int().min(1).max(30).default(10).describe("How many recent submissions to include"),
      },
      annotations: readOnly,
    },
    async ({ username, include_submissions, submission_limit }) => {
      return tool(async () => {
        const user = await hn.requireUser(username);
        if (!include_submissions) return formatUser(user);
        const ids = (user.submitted ?? []).slice(0, submission_limit);
        const recent = (await hn.getItems(ids)).filter((item): item is NonNullable<typeof item> => item !== null);
        return formatUser(user, recent);
      });
    },
  );

  server.registerTool(
    "hn_get_updates",
    {
      title: "Get HN updates",
      description:
        "Return item IDs and profile names that changed recently according to the official HN updates endpoint. Useful for watching the live firehose.",
      inputSchema: {},
      annotations: readOnly,
    },
    async () => {
      return tool(async () => {
        const updates = await hn.getUpdates();
        return [
          "# Recent HN updates",
          "",
          `Changed items (${updates.items.length}): ${updates.items.join(", ")}`,
          "",
          `Changed profiles (${updates.profiles.length}): ${updates.profiles.join(", ")}`,
        ].join("\n");
      });
    },
  );

  server.registerTool(
    "hn_get_max_item",
    {
      title: "Get max HN item ID",
      description:
        "Return the current largest Hacker News item ID. Walking backward from this ID enumerates new items as they are created.",
      inputSchema: {},
      annotations: readOnly,
    },
    async () => {
      return tool(async () => {
        const maxId = await hn.getMaxItem();
        return `Current max item ID: ${maxId}\nhttps://news.ycombinator.com/item?id=${maxId}`;
      });
    },
  );

  server.registerTool(
    "hn_search",
    {
      title: "Search Hacker News",
      description:
        "Full-text search over HN stories and comments. The official Firebase API has no search endpoint, so this uses the public Algolia HN Search API that the HN website itself uses. Filter with tags such as story, comment, ask_hn, show_hn, or front_page.",
      inputSchema: {
        query: z.string().min(0).max(200).describe("Search query; empty string is valid with tags like front_page"),
        tags: tagSchema.optional().describe("Restrict results to an HN type or front_page"),
        author: usernameSchema.optional().describe("Only results by this username"),
        sort: z.enum(["relevance", "date"]).default("relevance"),
        page: z.number().int().min(0).max(50).default(0),
        hits_per_page: z.number().int().min(1).max(50).default(20),
        min_points: z.number().int().min(0).optional().describe("Minimum score (numericFilters points>=N)"),
      },
      annotations: readOnly,
    },
    async ({ query, tags, author, sort, page, hits_per_page, min_points }) => {
      return tool(async () => {
        const tagParts = [tags, author ? `author_${author}` : null].filter(Boolean);
        const numeric = min_points != null ? `points>=${min_points}` : undefined;
        const result = await hn.search({
          query,
          tags: tagParts.length ? tagParts.join(",") : undefined,
          sort,
          page,
          hitsPerPage: hits_per_page,
          numericFilters: numeric,
        });
        return formatSearch(result);
      });
    },
  );

  server.registerResource(
    "hn-feeds",
    new ResourceTemplate("hn://feed/{feed}", {
      list: async () => ({
        resources: STORY_FEEDS.map((feed) => ({
          uri: `hn://feed/${feed}`,
          name: `${feed} stories`,
          description: `Current ${feed} feed from the official Hacker News API`,
          mimeType: "text/plain",
        })),
      }),
    }),
    {
      title: "HN story feed",
      description: "Live Hacker News story lists (top, new, best, ask, show, job)",
      mimeType: "text/plain",
    },
    async (uri, { feed }) => {
      const parsed = feedSchema.safeParse(feed);
      if (!parsed.success) {
        throw new Error(`Unknown feed "${String(feed)}". Use one of: ${STORY_FEEDS.join(", ")}`);
      }
      const result = await hn.getStories(parsed.data, 20, 0);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: formatStoryList(parsed.data, result.items, result.offset, result.total),
          },
        ],
      };
    },
  );

  server.registerResource(
    "hn-item",
    new ResourceTemplate("hn://item/{id}", { list: undefined }),
    {
      title: "HN item",
      description: "A Hacker News story, comment, job, or poll by ID",
      mimeType: "text/plain",
    },
    async (uri, { id }) => {
      const itemId = parseItemId(id);
      if (itemId == null) {
        throw new Error(`Invalid item id: ${String(id)}`);
      }
      const item = await hn.requireItem(itemId);
      const text =
        item.type === "poll" && item.parts?.length
          ? formatItem(item, { pollOptions: (await hn.getPoll(item)).options })
          : formatItem(item);
      return {
        contents: [{ uri: uri.href, mimeType: "text/plain", text }],
      };
    },
  );

  server.registerResource(
    "hn-user",
    new ResourceTemplate("hn://user/{username}", { list: undefined }),
    {
      title: "HN user",
      description: "A Hacker News user profile by username",
      mimeType: "text/plain",
    },
    async (uri, { username }) => {
      const name = String(username);
      if (!isHnUsername(name)) {
        throw new Error("Invalid username");
      }
      const user = await hn.requireUser(name);
      return {
        contents: [{ uri: uri.href, mimeType: "text/plain", text: formatUser(user) }],
      };
    },
  );

  server.registerPrompt(
    "hn_front_page",
    {
      title: "Summarize the HN front page",
      description: "Ask the model to fetch and summarize current top Hacker News stories",
      argsSchema: {
        count: z.string().regex(/^[1-9]\d?$/).optional().describe("How many stories to include (default 15)"),
      },
    },
    ({ count }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Use the hn_list_stories tool to fetch the current Hacker News top feed (limit ${count || "15"}). Summarize the front page for someone who has been offline: group related themes, call out the most discussed threads, and include story IDs plus URLs so I can click through.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "hn_explain_story",
    {
      title: "Explain an HN story",
      description: "Fetch a story and its comments, then explain the discussion",
      argsSchema: {
        id: z.string().regex(/^\d{1,10}$/).describe("HN item ID"),
      },
    },
    ({ id }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Explain Hacker News item ${id}. First call hn_get_item with id ${id}, then hn_get_comments with a depth of 2. Summarize the submission, the tone of the discussion, the strongest arguments, and any notable disagreements. Quote sparingly and cite comment IDs.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "hn_user_digest",
    {
      title: "HN user digest",
      description: "Profile a Hacker News user from public activity",
      argsSchema: {
        username: usernameSchema,
      },
    },
    ({ username }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Profile the Hacker News user "${username}". Call hn_get_user with include_submissions true. Describe their karma, tenure, what they tend to post or comment on, and list a few representative submissions with IDs.`,
          },
        },
      ],
    }),
  );

  return server;
}

async function tool(fn: () => Promise<string>) {
  try {
    const text = await fn();
    return { content: [{ type: "text" as const, text }] };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true };
  }
}
