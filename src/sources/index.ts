import type { SourceFetcher } from "./types";
import { fetchRss } from "./rss";
import { fetchReddit } from "./reddit";
import { fetchGoogleNews } from "./googlenews";

// Adding a new source type = write a module returning FetchedItem[] and register it here.
export const SOURCE_FETCHERS: Record<string, SourceFetcher> = {
  rss: fetchRss,
  reddit: fetchReddit,
  googlenews: fetchGoogleNews,
};
