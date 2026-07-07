# Personal Content Aggregator — Design Doc (v2)

A single-user, AI-assisted news/content dashboard that pulls from multiple sources, summarizes everything so you can read in-place, and slowly learns your taste through your own feedback.

---

## 1. Core Concept

Not a news reader. A personal recommendation engine that starts from zero and gets better as you use it. You never have to visit 10 different sites — articles, threads, and posts get pulled in, summarized, and shown to you directly, with a link to the original only if you want to go deeper.

---

## 2. System Overview

Two halves, deliberately separated:

- **Pipeline (GitHub Actions):** a scheduled workflow runs the fetch → extract → summarize → store loop as a plain script with no execution-time limits. This is where all the slow, rate-limited work happens.
- **App (Vercel + Next.js):** serves the dashboard and handles interactive requests (votes, saves, Ask-AI, manual refresh). Never does bulk work.

```
┌──────────────────────── GitHub Actions (daily cron + manual dispatch) ────────────────────────┐
│                                                                                                │
│  Sources ──▶ Fetch ──▶ Dedup ──▶ Extract full text ──▶ Summarize + categorize ──▶ Retention   │
│  (RSS,       (per-     (exact,   (readability, with     (Gemini Flash, rate-      (prune old   │
│   Reddit,     source    unique    graceful fallback      limited, daily budget)     raw text)   │
│   later HN)   modules)  constr.)  to excerpt)                                                   │
│                                        │                                                       │
└────────────────────────────────────────┼───────────────────────────────────────────────────────┘
                                         ▼
                              ┌─────────────────────┐
                              │  Postgres (Supabase) │
                              └──────────┬──────────┘
                                         ▼
                        ┌────────────────────────────────┐
                        │  Next.js app on Vercel          │
                        │  - Feed (scored at query time)  │
                        │  - Discover                     │
                        │  - Saved                        │
                        │  - Ask-AI                       │
                        │  - Manual refresh (dispatches   │
                        │    the GitHub workflow)         │
                        │  - Shared-password auth         │
                        └────────────────────────────────┘
```

**Why GitHub Actions for the pipeline instead of Vercel cron:** the pipeline's wall-clock time is dominated by Gemini free-tier rate limits (~10–15 requests/min) and dozens of article fetches. That's minutes of runtime on a normal morning — past what a serverless function invocation should do. GitHub Actions scheduled workflows are free, allow hours of runtime, and can sleep between API calls without anyone caring. Vercel then only does what it's good at: serving the app instantly from anywhere.

---

## 3. Source Layer

Every source is its own small, self-contained module with one job: return a list of items in a common shape.

```ts
{
  title: string,
  url: string,                // canonicalized (tracking params stripped) before storage
  rawContent: string | null,  // full text if the source provides it
  sourceName: string,         // e.g. "r/programming", "TechCrunch"
  sourceType: string,         // "rss" | "reddit" | "hackernews" | ...
  publishedAt: Date,
  externalId: string          // unique per source — dedup key
}
```

Adding a new source later = writing one new module that returns this shape. Nothing else in the system needs to change.

**Sources to start with:**
- **RSS** — tech blogs, any site with a feed. Feeds often contain only excerpts; full text comes from the extraction step, not the feed.
- **Reddit — via OAuth from day one.** The unauthenticated public JSON endpoints are blocked/heavily throttled from datacenter IPs (which is what both GitHub Actions runners and Vercel use). A free "script"-type Reddit app + OAuth client-credentials flow avoids this entirely and gives a real rate limit. Not optional; the no-auth route is a trap.

**Sources to add later:** Hacker News (public API, no auth), GitHub Trending (scrape/unofficial API), newsletters (email-to-feed bridge), arbitrary sites without RSS. Twitter/X: skip — API access is effectively paid now.

The starting feed/subreddit list lives in the `sources` table (seeded by a script, editable without code changes).

---

## 4. Fetch, Dedup & Extraction

**Schedule:** GitHub Actions cron, daily at 8am local time (stored as UTC — the workflow uses two cron entries or a timezone check to stay correct across DST). Note: GitHub cron is best-effort and can run 10–30 minutes late at busy times; fine for morning news. Plus:
- a manual **Refresh** button in the app (triggers the same workflow via the GitHub API `workflow_dispatch`),
- an **auto-run toggle** (a row in the `settings` table; the workflow checks it first and exits if disabled).

**Dedup (v1 — exact only):**
- `UNIQUE (source_id, external_id)` constraint — the same item fetched twice is a no-op upsert.
- Canonical-URL matching catches the same link arriving via two feeds.
- **Cross-outlet fuzzy clustering ("same story, different site") is deliberately deferred.** It needs embeddings or trigram similarity plus a cluster representation, and for a single-user dashboard it's cosmetic. Revisit only if duplicate stories actually annoy in practice.

**Full-text extraction (the honest version):** this is the most failure-prone component in the system, not a solved step.
- Use a readability-style extractor (`@mozilla/readability` + `jsdom`).
- Expect ~70–85% success. Paywalls, JS-rendered pages, and bot-blocking will fail — that's normal.
- Every item stores a `content_status`: `full` | `excerpt` | `failed`. On failure, summarize from the RSS excerpt and mark it, so the summary is honest about its basis and Ask-AI knows it's working from partial text.

**Observability:** every run writes a `fetch_runs` row (status, counts, error). The UI quietly shows "last updated" from this table, so a silently failed morning run looks stale *and says so* instead of just looking stale.

---

## 5. Summarization Layer (AI)

- **Gemini API free tier (Flash model)** — no cost. Kept behind a small `summarize()` interface so the provider can be swapped if the free tier changes.
- One structured call per item returns **summary + category + tags** together (categories are assigned here — see §6; the model picks from a fixed configured list, with an "Other" fallback).
- **Rate limiting is designed in, not bolted on:** the pipeline sleeps between calls to stay under the free tier's requests-per-minute limit, caps items per run, and enforces a daily request budget in code so a bug can't burn the day's quota (free-tier daily caps are real, and a lockout lasts until midnight Pacific).
- Summarization is a **separate phase from fetching**: items are stored raw first, then a "summarize up to K unsummarized items" loop runs. A partial failure never loses fetched data.
- **Ask-AI:** a chat box under each summary sends your question + the stored article text to Gemini. If `raw_content` has been pruned (see retention), it re-fetches the article on demand; if extraction fails, it answers from the excerpt and says so. Shares the same rate limit/daily budget. Behind auth like everything else.
- Fine print: Google may use free-tier API inputs for training. Acceptable here (public news articles + your questions about them); worth knowing.

The AI model itself is never trained or fine-tuned. It's a stateless tool called fresh each time. Personalization lives entirely in your own data, not inside the model.

---

## 6. Your Taste Profile (the personalization layer)

Plain data in your database — fully yours, fully inspectable:

- Every thumbs up/down, every save
- **Reads** — defined precisely: opening an item's summary counts as read; scrolling past does not. ("Read items disappear from the feed" hangs on this definition.)
- Timestamps, so recent behavior matters more than old behavior

**How it's used:**

1. **Scoring (no AI, computed at query time):**

   ```
   score = recency_decay(published_at)
         × (1 + w_src · source_affinity + w_cat · category_affinity)
         + exploration_bonus
   ```

   Affinities are computed directly from `user_actions` with time decay. **No cached `taste_profile` table in v1** — at single-user data volumes, computing this in the feed query is fast, and it's one less thing to keep in sync. Add a cache only if it's ever measurably slow.

   The **exploration bonus** goes to sources/categories you've barely been shown — without it, engagement-based ranking is self-reinforcing and new sources can never earn a score.

2. **In-context personalization (AI):** for Discover, a short written summary of your taste (derived from the same data) is included in the Gemini prompt so it can reason about fit — freshly, every time, no training.

---

## 7. Data Model (Postgres — Supabase free tier)

```
sources
  id, name, type, config (jsonb — feed URL / subreddit / etc.), active, created_at

items
  id, source_id, title, url, canonical_url, external_id,
  published_at, fetched_at,
  raw_content (nullable), content_status ("full" | "excerpt" | "failed"),
  summary, category, tags,
  UNIQUE (source_id, external_id)

user_actions
  id, item_id, action_type ("upvote" | "downvote" | "save" | "read" | "dismiss"),
  created_at

fetch_runs
  id, started_at, finished_at, status ("running" | "success" | "partial" | "failed"),
  items_fetched, items_summarized, error

settings
  key, value   (e.g. auto_fetch_enabled)
```

**Retention:** Supabase free tier is ~500MB. Full article text forever would eat that in months, so the pipeline's last phase nulls `raw_content` on items older than 30 days **unless saved**. Summaries and metadata are tiny and kept forever. Ask-AI re-fetches pruned articles on demand.

Migrations + typed queries via Drizzle ORM (shared between the app and the pipeline script — one language, one schema definition).

---

## 8. Web App Layer

- **Framework:** Next.js (App Router, TypeScript) on Vercel. API routes handle only quick interactive work: recording actions, Ask-AI calls, dispatching the refresh workflow, serving the feed.
- **Auth (required — this is a public URL):** single shared password, checked in middleware, sets a signed cookie. No accounts, no OAuth — but without it, anyone who finds the URL can read your feed and burn your Gemini quota through Ask-AI.
- **Views:**
  - **Feed** — relevance-scored stream (formula in §6), grouped by category tabs. Read items disappear.
  - **Discover / "Maybe I'd Like"** — exploratory picks, taste-based plus deliberately outside your lane. Explicit thumbs up/down actively trains the profile.
  - **Saved** — permanent library; saved items are also exempt from raw-content pruning.
- **Design direction:** card-based browsing (title, source, teaser, category tag), clean article-style typography inside a summary. Instant vote/save interactions, no page reloads.

---

## 9. Hosting (free, accessible from anywhere)

**Stack: Vercel (app) + Supabase (Postgres) + GitHub Actions (pipeline)**

- **Vercel:** free Hobby tier serves the app with negligible cold starts. It runs no bulk work, so its function time limits never matter.
- **Supabase over Neon:** comparable free Postgres, but Supabase leaves room for its auth product later, and its inactivity pause (1 week) is never triggered by a daily pipeline.
- **GitHub Actions:** free scheduled workflows with hours of allowed runtime — the pipeline sleeps through rate limits without gymnastics. The manual Refresh button hits the GitHub API (`workflow_dispatch`) using a repo-scoped token stored in Vercel env vars.
- **No home server dependency, no ongoing cost.** Accessible from your phone or any browser.

**Accounts/secrets required (all free):** GitHub repo, Vercel account, Supabase project (`DATABASE_URL`), Gemini API key (AI Studio), Reddit script-app client id/secret, a chosen app password, and a GitHub token for the refresh button. Nothing else.

---

## 10. Build Philosophy

- Built once, but structured to make adding sources/features painless later.
- Prioritize working end-to-end early (RSS only is enough to start generating taste data) over building every source first.
- Every external dependency (Gemini, Reddit, extraction) has a designed failure mode, because at free tier, failures are routine, not exceptional.

---

## 11. Build Order

1. Repo + Next.js skeleton (TypeScript, App Router, Tailwind) + Drizzle schema & migrations
2. Auth middleware (shared password)
3. RSS source module + pipeline script (fetch phase), runnable locally
4. Extraction step with `content_status` fallbacks
5. Gemini summarize/categorize phase with rate limiting + daily budget
6. Feed UI (cards, category tabs, summary view)
7. Actions (upvote/downvote/save/read/dismiss) + query-time scoring
8. Reddit source module (OAuth)
9. Discover view (scoring + Gemini taste-summary prompt)
10. GitHub Actions workflow + `fetch_runs` + Refresh button + auto-run toggle
11. Ask-AI chat per article (with re-fetch fallback)
12. Retention pruning phase
13. Deploy: Supabase project, Vercel, GitHub secrets
14. Later: Hacker News, GitHub Trending, cross-outlet dedup if duplicates actually annoy
