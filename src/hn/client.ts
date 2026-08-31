import {
  ALGOLIA_API_BASE,
  HN_API_BASE,
  type AlgoliaSearchResponse,
  type CommentNode,
  type HnItem,
  type HnUpdates,
  type HnUser,
  type StoryFeed,
} from "./types";

const USER_AGENT = "hackernews-mcp/1.0 (+https://github.com/reeceatkinson/hackernews-mcp)";
const DEFAULT_TIMEOUT_MS = 10_000;
const ITEM_CONCURRENCY = 12;

export class HnApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly url?: string,
  ) {
    super(message);
    this.name = "HnApiError";
  }
}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface HnClientOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

export class HnClient {
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly cache = new Map<string, Promise<unknown>>();

  constructor(options: HnClientOptions = {}) {
    const impl = options.fetchImpl;
    this.fetchImpl = impl ? (input, init) => impl(input, init) : (input, init) => fetch(input, init);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async getItem(id: number): Promise<HnItem | null> {
    return this.getJson<HnItem | null>(`${HN_API_BASE}/item/${id}.json`);
  }

  async requireItem(id: number): Promise<HnItem> {
    const item = await this.getItem(id);
    if (!item) {
      throw new HnApiError(`Item ${id} was not found`);
    }
    return item;
  }

  async getUser(username: string): Promise<HnUser | null> {
    return this.getJson<HnUser | null>(`${HN_API_BASE}/user/${encodeURIComponent(username)}.json`);
  }

  async requireUser(username: string): Promise<HnUser> {
    const user = await this.getUser(username);
    if (!user) {
      throw new HnApiError(`User "${username}" was not found (only accounts with public activity are in the API)`);
    }
    return user;
  }

  async getMaxItem(): Promise<number> {
    return this.getJson<number>(`${HN_API_BASE}/maxitem.json`);
  }

  async getUpdates(): Promise<HnUpdates> {
    return this.getJson<HnUpdates>(`${HN_API_BASE}/updates.json`);
  }

  async getStoryIds(feed: StoryFeed): Promise<number[]> {
    const path = feed === "job" ? "jobstories" : `${feed}stories`;
    return this.getJson<number[]>(`${HN_API_BASE}/${path}.json`);
  }

  async getStories(feed: StoryFeed, limit: number, offset: number): Promise<{
    items: HnItem[];
    total: number;
    offset: number;
  }> {
    const ids = await this.getStoryIds(feed);
    const slice = ids.slice(offset, offset + limit);
    const items = (await this.getItems(slice)).filter((item): item is HnItem => item !== null);
    return { items, total: ids.length, offset };
  }

  async getItems(ids: number[]): Promise<Array<HnItem | null>> {
    return mapPool(ids, ITEM_CONCURRENCY, (id) => this.getItem(id));
  }

  async getPoll(item: HnItem): Promise<{ item: HnItem; options: HnItem[] }> {
    const optionIds = item.parts ?? [];
    const options = (await this.getItems(optionIds)).filter((part): part is HnItem => part !== null);
    return { item, options };
  }

  async getCommentTree(
    id: number,
    maxDepth: number,
    maxComments: number,
  ): Promise<{ root: HnItem; tree: CommentNode[]; truncated: boolean }> {
    const root = await this.requireItem(id);
    let remaining = maxComments;
    let truncated = false;

    const walk = async (parent: HnItem, depth: number): Promise<CommentNode[]> => {
      if (!parent.kids?.length || remaining <= 0 || depth > maxDepth) {
        if (parent.kids?.length && (remaining <= 0 || depth > maxDepth)) truncated = true;
        return [];
      }

      const childIds = parent.kids.slice(0, remaining);
      if (parent.kids.length > childIds.length) truncated = true;
      remaining -= childIds.length;

      const children = (await this.getItems(childIds)).filter((item): item is HnItem => item !== null);
      const nodes: CommentNode[] = [];
      for (const child of children) {
        const replies = depth < maxDepth ? await walk(child, depth + 1) : [];
        if (depth >= maxDepth && child.kids?.length) truncated = true;
        nodes.push({ item: child, replies });
      }
      return nodes;
    };

    const tree = await walk(root, 1);
    return { root, tree, truncated };
  }

  async search(params: {
    query: string;
    tags?: string;
    sort?: "relevance" | "date";
    page?: number;
    hitsPerPage?: number;
    numericFilters?: string;
  }): Promise<AlgoliaSearchResponse> {
    const endpoint = params.sort === "date" ? "search_by_date" : "search";
    const url = new URL(`${ALGOLIA_API_BASE}/${endpoint}`);
    url.searchParams.set("query", params.query);
    if (params.tags) url.searchParams.set("tags", params.tags);
    if (params.numericFilters) url.searchParams.set("numericFilters", params.numericFilters);
    url.searchParams.set("page", String(params.page ?? 0));
    url.searchParams.set("hitsPerPage", String(params.hitsPerPage ?? 20));
    return this.getJson<AlgoliaSearchResponse>(url.toString());
  }

  private getJson<T>(url: string): Promise<T> {
    const cached = this.cache.get(url);
    if (cached) return cached as Promise<T>;

    const pending = this.fetchJson<T>(url);
    this.cache.set(url, pending);
    return pending;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const init: RequestInit & { cf?: { cacheTtl: number; cacheEverything: boolean } } = {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(this.timeoutMs),
      cf: {
        cacheTtl: 45,
        cacheEverything: true,
      },
    };
    const response = await this.fetchImpl(url, init);

    if (!response.ok) {
      throw new HnApiError(`HN API request failed with ${response.status}`, response.status, url);
    }

    return (await response.json()) as T;
  }
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });

  await Promise.all(workers);
  return results;
}
