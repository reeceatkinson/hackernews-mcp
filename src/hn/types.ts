export const HN_API_BASE = "https://hacker-news.firebaseio.com/v0";
export const HN_SITE = "https://news.ycombinator.com";
export const ALGOLIA_API_BASE = "https://hn.algolia.com/api/v1";

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
