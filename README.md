# News Dashboard

Single-user, AI-assisted content aggregator. Sources get fetched daily by a GitHub Actions
pipeline, summarized by Gemini, and served as a personalized feed from Vercel.
Full design rationale in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Local development

```bash
cp .env.example .env        # fill in DATABASE_URL, APP_PASSWORD, GEMINI_API_KEY, REDDIT_*
npm install
npm run db:push             # create tables in Postgres
npm run db:seed             # seed starter sources + settings
npm run pipeline            # run a full fetch/summarize pass locally
npm run dev                 # http://localhost:3000
```

## Deployment checklist

1. **Supabase**: create a free project; use the **transaction pooler** connection string
   (port 6543) as `DATABASE_URL`. Run `npm run db:push` and `npm run db:seed` against it.
2. **GitHub**: push this repo; add repo secrets `DATABASE_URL`, `GEMINI_API_KEY`,
   `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`. The workflow in
   `.github/workflows/pipeline.yml` runs daily at 8am Eastern (DST-proof double cron).
3. **Vercel**: import the repo; set env vars `DATABASE_URL`, `APP_PASSWORD`,
   `GEMINI_API_KEY`, `GITHUB_REPO` (`owner/name`), `GITHUB_TOKEN` (fine-grained token
   with Actions read/write on this repo — powers the Refresh button).
4. **Reddit**: create a free "script" app at reddit.com/prefs/apps for the client id/secret.
5. **Gemini**: free API key from aistudio.google.com.

## Adding sources / categories

- Sources: add a row via `src/db/seed.ts` (or insert into the `sources` table directly).
  New source *types* = one module in `src/sources/` returning the common item shape,
  registered in `src/sources/index.ts`.
- Categories: edit `CATEGORIES` in `src/lib/config.ts` — the summarizer and feed tabs
  pick the change up automatically.
