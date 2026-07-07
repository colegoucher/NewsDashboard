// Product-level knobs live here so tuning behavior never requires touching
// pipeline or UI logic. (Categories moved to src/lib/categories.ts — they're
// DB-backed now so topics can be added from the UI.)

// How long full article text is kept before being pruned (saved items exempt).
export const RAW_CONTENT_RETENTION_DAYS = 30;

// Feed shows items published within this window.
export const FEED_WINDOW_DAYS = 14;

// Gemini free-tier guards. Post-Dec-2025 quota cuts, observed daily quotas are
// as low as ~20 requests/model — so summarization is batched (many articles per
// call) and models are tried in a fallback chain (quotas are per-model).
export const GEMINI_MAX_RPM = Number(process.env.GEMINI_MAX_RPM ?? 10);
export const GEMINI_DAILY_BUDGET = Number(process.env.GEMINI_DAILY_BUDGET ?? 300);
// Quality-first: the smarter model summarizes the first batches of the day,
// then the chain degrades to lighter models as each daily quota runs out.
export const GEMINI_MODELS: string[] = (
  process.env.GEMINI_MODELS ??
  process.env.GEMINI_MODEL ??
  "gemini-2.5-flash,gemini-2.5-flash-lite,gemini-2.0-flash,gemini-2.0-flash-lite"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Articles per summarization call, and how much of each article goes in.
export const SUMMARIZE_PER_CALL = Number(process.env.SUMMARIZE_PER_CALL ?? 8);
export const BATCH_CONTENT_CHARS = 6000;

// Max items summarized per pipeline run (keeps a huge backlog from eating the day's budget).
export const SUMMARIZE_BATCH_LIMIT = Number(process.env.SUMMARIZE_BATCH_LIMIT ?? 80);

// Max items fetched per source per run.
export const FETCH_LIMIT_PER_SOURCE = 25;
