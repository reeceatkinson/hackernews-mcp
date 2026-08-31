export function landingPage(origin: string): string {
  const mcpUrl = `${origin.replace(/\/$/, "")}/mcp`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Hacker News MCP</title>
  <style>
    :root {
      color-scheme: light;
      --orange: #ff6600;
      --bg: #f6f6ef;
      --ink: #222;
      --muted: #666;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font: 16px/1.5 Verdana, Geneva, sans-serif;
      background: var(--bg);
      color: var(--ink);
    }
    header {
      background: var(--orange);
      color: #000;
      padding: 12px 20px;
      display: flex;
      gap: 12px;
      align-items: center;
    }
    header strong { font-size: 18px; }
    main { max-width: 780px; margin: 0 auto; padding: 24px 20px 64px; }
    code, pre {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 13px;
    }
    pre {
      background: #fff;
      border: 1px solid #e0e0e0;
      padding: 12px 14px;
      overflow-x: auto;
    }
    .url {
      background: #fff;
      border: 1px solid #e0e0e0;
      padding: 10px 12px;
      word-break: break-all;
    }
    ul { padding-left: 1.2em; }
    a { color: #000; }
    footer { color: var(--muted); font-size: 13px; margin-top: 40px; }
  </style>
</head>
<body>
  <header>
    <strong>Y</strong>
    <span>Hacker News MCP</span>
  </header>
  <main>
    <p>Remote Model Context Protocol server for the <a href="https://github.com/HackerNews/API">official Hacker News API</a>, hosted on Cloudflare Workers.</p>
    <p>Connect MCP clients to:</p>
    <p class="url"><code>${escapeHtml(mcpUrl)}</code></p>
    <h2>Tools</h2>
    <ul>
      <li><code>hn_list_stories</code> — top / new / best / ask / show / job feeds</li>
      <li><code>hn_get_item</code> — story, comment, job, or poll by ID</li>
      <li><code>hn_get_comments</code> — nested comment thread</li>
      <li><code>hn_get_user</code> — profile and optional recent submissions</li>
      <li><code>hn_get_updates</code> — recently changed items and profiles</li>
      <li><code>hn_get_max_item</code> — current largest item ID</li>
      <li><code>hn_search</code> — full-text search via Algolia (HN has no official search endpoint)</li>
    </ul>
    <h2>Cursor / Claude Desktop</h2>
    <pre>{
  "mcpServers": {
    "hackernews": {
      "url": ${JSON.stringify(mcpUrl)}
    }
  }
}</pre>
    <p>Older local-only clients can proxy with <code>npx mcp-remote ${escapeHtml(mcpUrl)}</code>.</p>
    <footer>
      Stateless MCP 2026-07-28 via <code>createMcpHandler</code>. No auth required — HN data is public.
    </footer>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
