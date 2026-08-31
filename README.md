# Hacker News MCP

Remote [Model Context Protocol](https://modelcontextprotocol.io) server for the [official Hacker News API](https://github.com/HackerNews/API). Stateless Cloudflare Worker via `createMcpHandler`. Search uses the public [Algolia HN Search API](https://hn.algolia.com/api) (the Firebase API has no search endpoint).

No authentication — HN data is public. Anyone who can reach the Worker can call the tools. Titles, text, and URLs in results are untrusted user content.

## Tools

| Tool | Source | What it does |
| --- | --- | --- |
| `hn_list_stories` | Firebase `/{feed}stories.json` + `/item/{id}.json` | Paginated top / new / best / ask / show / job |
| `hn_get_item` | `/item/{id}.json` | Story, comment, job, poll (polls include options) |
| `hn_get_comments` | `/item/{id}.json` walked via `kids` | Nested thread with depth and count caps |
| `hn_get_user` | `/user/{id}.json` | Profile, optional recent submissions |
| `hn_get_updates` | `/updates.json` | Recently changed items and profiles |
| `hn_get_max_item` | `/maxitem.json` | Current largest item ID |
| `hn_search` | [Algolia HN Search](https://hn.algolia.com/api) | Full-text search |

Resources: `hn://feed/{feed}`, `hn://item/{id}`, `hn://user/{username}`.

Prompts: `hn_front_page`, `hn_explain_story`, `hn_user_digest`.

## Develop

```sh
npm install
npm start
```

- MCP: `http://localhost:8787/mcp`
- Health: `http://localhost:8787/health`

```sh
npm test
npm run check
```

`npm install` runs `wrangler types` so `Env` matches `wrangler.jsonc`.

Inspector: `npx @modelcontextprotocol/inspector@latest`, then connect to `http://localhost:8787/mcp`.

## Deploy

```sh
npx wrangler login
npm run deploy
```

Endpoint: `https://hackernews-mcp.<your-subdomain>.workers.dev/mcp`.

Custom domain: set `allowedHostnames` and `allowedOriginHostnames` on `createMcpHandler`. The default allowlist is localhost plus the Worker's `workers.dev` hostname.

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

Local-only clients: `npx mcp-remote https://hackernews-mcp.<your-subdomain>.workers.dev/mcp`.

## License

MIT
