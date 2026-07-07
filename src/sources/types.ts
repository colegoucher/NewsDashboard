export interface FetchedItem {
  title: string;
  url: string;
  rawContent: string | null; // full text if the source provides it directly
  publishedAt: Date;
  externalId: string; // unique per source — dedup key
  /** true when rawContent is already the complete content (e.g. reddit self-post) */
  contentComplete?: boolean;
  imageUrl?: string | null; // thumbnail if the source provides one
}

export interface SourceRecord {
  id: number;
  name: string;
  type: string;
  config: Record<string, string>;
}

export type SourceFetcher = (source: SourceRecord, limit: number) => Promise<FetchedItem[]>;
