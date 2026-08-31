# Hacker News MCP

Remote [Model Context Protocol](https://modelcontextprotocol.io) server for the [official Hacker News API](https://github.com/HackerNews/API), hosted on Cloudflare Workers.

This is a **stateless** Worker using `createMcpHandler` from the Agents SDK (MCP 2026-07-28, with compatibility for older Streamable HTTP clients). It does **not** use the `remote-mcp-authless` / `McpAgent` template — that path is deprecated and needs a Durable Object for session state this server does not have.

## Why this stack

| Approach | Use it? | Why |
| --- | --- | --- |
| `npm create cloudflare --template=cloudflare/ai/demos/remote-mcp-authless` | No for new servers | Still ships the frozen `McpAgent` Durable Object path |
| [`examples/mcp-worker`](https://github.com/cloudflare/agents/tree/main/examples/mcp-worker) + `createMcpHandler` | Yes | Current recommendation: plain Worker, no DO, one factory per request |

HN is a public, unauthenticated JSON API, so a stateless handler is the right fit.

## Tools

| Tool | Source | What it does |
| --- | --- | --- |
| `hn_list_stories` | Firebase `/{feed}stories.json` + `/item/{id}.json` | Paginated top / new / best / ask / show / job |
| `hn_get_item` | `/item/{id}.json` | Story, comment, job, poll (polls include options) |
| `hn_get_comments` | `/item/{id}.json` walked via `kids` | Nested thread with depth and count caps |
| `hn_get_user` | `/user/{id}.json` | Profile, optional recent submissions |
| `hn_get_updates` | `/updates.json` | Recently changed items and profiles |
| `hn_get_max_item` | `/maxitem.json` | Current largest item ID |
| `hn_search` | [Algolia HN Search](https://hn.algolia.com/api) | Full-text search — the official API has no search endpoint; this is the same index the HN website uses |

Resources: `hn://feed/{feed}`, `hn://item/{id}`, `hn://user/{username}`.

Prompts: `hn_front_page`, `hn_explain_story`, `hn_user_digest`.

## Develop

```sh
npm install
npm start
```

- MCP endpoint: `http://localhost:8787/mcp`
- Health: `http://localhost:8787/health`

```sh
npm test
npm run check
```

`npm install` also runs `wrangler types` so `Env` and Workers runtime types stay in sync with `wrangler.jsonc`.

Inspector:

```sh
npx @modelcontextprotocol/inspector@latest
```

Then connect to `http://localhost:8787/mcp`.

## Deploy

```sh
npx wrangler login
npm run deploy
```

The Worker will be at `https://hackernews-mcp.<your-subdomain>.workers.dev/mcp`.

## Connect a client

```json
{
  "mcpServers": {
    "hackernews": {
      "url": "https://hackernews-mcp.<your-subdomain>.workers.dev/mcp"
    }
  }
}
```

Local-only clients can use `npx mcp-remote https://hackernews-mcp.<your-subdomain>.workers.dev/mcp`.
