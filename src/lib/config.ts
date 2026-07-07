// Product-level knobs live here so adding a category or tuning behavior
// never requires touching pipeline or UI logic.

export const CATEGORIES = [
  "Programming",
  "AI & ML",
  "Tech News",
  "World News",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

// How long full article text is kept before being pruned (saved items exempt).
export const RAW_CONTENT_RETENTION_DAYS = 30;

// Feed shows items published within this window.
export const FEED_WINDOW_DAYS = 14;

// Gemini free-tier guards.
export const GEMINI_MAX_RPM = Number(process.env.GEMINI_MAX_RPM ?? 8);
export const GEMINI_DAILY_BUDGET = Number(process.env.GEMINI_DAILY_BUDGET ?? 200);
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

// Max items summarized per pipeline run (keeps a huge backlog from eating the day's budget).
export const SUMMARIZE_BATCH_LIMIT = Number(process.env.SUMMARIZE_BATCH_LIMIT ?? 80);

// Max items fetched per source per run.
export const FETCH_LIMIT_PER_SOURCE = 25;
