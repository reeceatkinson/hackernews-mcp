export const HN_API_BASE = "https://hacker-news.firebaseio.com/v0";
export const HN_SITE = "https://news.ycombinator.com";
export const ALGOLIA_API_BASE = "https://hn.algolia.com/api/v1";

/** Letters, digits, dash, underscore. 80 matches the existing tool string cap. */
export const HN_USERNAME_RE = /^[A-Za-z0-9_-]{1,80}$/;
export const MAX_ITEM_ID = 2_147_483_647;

export function isHnUsername(value: string): boolean {
  return HN_USERNAME_RE.test(value);
}

export function parseItemId(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 1 && value <= MAX_ITEM_ID ? value : null;
  }
  if (typeof value === "string" && /^\d{1,10}$/.test(value)) {
    const id = Number(value);
    return id >= 1 && id <= MAX_ITEM_ID ? id : null;
  }
  return null;
}

export const STORY_FEEDS = [
  "top",
  "new",
  "best",
  "ask",
  "show",
  "job",
] as const;

export type StoryFeed = (typeof STORY_FEEDS)[number];

export type HnItemType = "job" | "story" | "comment" | "poll" | "pollopt";

export interface HnItem {
  id: number;
  deleted?: boolean;
  type?: HnItemType;
  by?: string;
  time?: number;
  text?: string;
  dead?: boolean;
  parent?: number;
  poll?: number;
  kids?: number[];
  url?: string;
  score?: number;
  title?: string;
  parts?: number[];
  descendants?: number;
}

export interface HnUser {
  id: string;
  created: number;
  karma: number;
  about?: string;
  submitted?: number[];
}

export interface HnUpdates {
  items: number[];
  profiles: string[];
}

export interface AlgoliaHit {
  objectID: string;
  title?: string | null;
  url?: string | null;
  author?: string | null;
  points?: number | null;
  num_comments?: number | null;
  story_text?: string | null;
  comment_text?: string | null;
  story_id?: number | null;
  story_title?: string | null;
  created_at?: string | null;
  created_at_i?: number | null;
  _tags?: string[];
}

export interface AlgoliaSearchResponse {
  hits: AlgoliaHit[];
  page: number;
  nbHits: number;
  nbPages: number;
  hitsPerPage: number;
  query: string;
}

export interface CommentNode {
  item: HnItem;
  replies: CommentNode[];
}
