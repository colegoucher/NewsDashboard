import { Nav } from "@/components/nav";
import { categoryColor } from "@/lib/category-colors";
import { tasteReport } from "@/lib/taste";

export const dynamic = "force-dynamic";

export default async function TastePage() {
  const report = await tasteReport();
  const { stats } = report;
  const hasData = stats.read + stats.upvoted + stats.saved + stats.downvoted > 0;

  return (
    <>
      <Nav active="taste" />
      <main className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
        <h1 className="mb-1 text-xl font-bold tracking-tight">What the ranker believes about you</h1>
        <p className="mb-6 text-sm text-stone-500">
          Computed live from your votes, saves, and reads — recent behavior counts more. This is
          the entire personalization engine; nothing hidden.
        </p>

        {!hasData ? (
          <p className="py-16 text-center text-sm text-stone-500">
            No signals yet — read, vote, and save for a few days and this page comes alive.
          </p>
        ) : (
          <div className="space-y-8">
            {/* fun stats row */}
            <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Stat label="read" value={stats.read} emoji="👀" />
              <Stat label="saved" value={stats.saved} emoji="🔖" />
              <Stat label="upvoted" value={stats.upvoted} emoji="▲" />
              <Stat label="downvoted" value={stats.downvoted} emoji="▼" />
            </section>

            <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm leading-relaxed dark:border-stone-800 dark:bg-stone-900">
              <p>
                📚 Your library holds <b>{stats.totalItems}</b> articles ({stats.summarized}{" "}
                summarized).
                {stats.mostReadSource && (
                  <>
                    {" "}
                    Your most-read source is <b>{stats.mostReadSource}</b>.
                  </>
                )}
                {stats.mostDismissedCategory && (
                  <>
                    {" "}
                    You ghost <b>{stats.mostDismissedCategory}</b> the most. 💔
                  </>
                )}
              </p>
            </section>

            {report.categories.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
                  Categories
                </h2>
                <div className="space-y-2">
                  {report.categories.map((c) => (
                    <AffinityBar
                      key={c.name}
                      label={c.name}
                      score={c.score}
                      pill={categoryColor(c.name)}
                    />
                  ))}
                </div>
              </section>
            )}

            {report.sources.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
                  Sources
                </h2>
                <div className="space-y-2">
                  {report.sources.map((s) => (
                    <AffinityBar
                      key={s.name}
                      label={`${s.name} · ${s.interactions} interactions`}
                      score={s.score}
                    />
                  ))}
                </div>
              </section>
            )}

            {report.topTags.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
                  Your obsessions this month
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {report.topTags.map((t) => (
                    <span
                      key={t.tag}
                      className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300"
                      style={{ fontSize: `${Math.min(1.05, 0.75 + t.count * 0.03)}rem` }}
                    >
                      {t.tag} <span className="opacity-60">×{t.count}</span>
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </>
  );
}

function Stat({ label, value, emoji }: { label: string; value: number; emoji: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-3 text-center dark:border-stone-800 dark:bg-stone-900">
      <div className="text-lg">{emoji}</div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  );
}

function AffinityBar({ label, score, pill }: { label: string; score: number; pill?: string }) {
  const pct = Math.round(Math.abs(score) * 100);
  const positive = score >= 0;
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-2.5 dark:border-stone-800 dark:bg-stone-900">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className={pill ? `rounded-full px-2 py-0.5 font-medium ${pill}` : "font-medium"}>
          {label}
        </span>
        <span className="text-stone-500">
          {positive ? "likes" : "avoids"} {pct}%
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
        <div className="flex w-1/2 justify-end">
          {!positive && (
            <div className="h-full rounded-l-full bg-rose-400" style={{ width: `${pct}%` }} />
          )}
        </div>
        <div className="w-1/2">
          {positive && (
            <div
              className="h-full rounded-r-full bg-gradient-to-r from-indigo-500 to-fuchsia-500"
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
