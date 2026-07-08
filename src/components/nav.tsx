import Link from "next/link";
import { getLastRun } from "@/lib/queries";
import { getSetting } from "@/lib/settings";
import { RefreshControls } from "./refresh-controls";

export async function Nav({
  active,
}: {
  active: "feed" | "discover" | "saved" | "taste" | "search";
}) {
  const [lastRun, autoFetch] = await Promise.all([getLastRun(), getSetting("auto_fetch_enabled")]);

  const tab = (href: string, key: string, label: string, emoji: string) => (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition sm:py-1.5 ${
        active === key
          ? "bg-indigo-600 text-white shadow-sm"
          : "text-stone-600 hover:bg-stone-200/70 dark:text-stone-400 dark:hover:bg-stone-800"
      }`}
    >
      <span className="text-base sm:text-sm">{emoji}</span>
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-10 border-b border-stone-200/80 bg-[var(--background)]/85 backdrop-blur-md dark:border-stone-800">
      <div className="mx-auto max-w-3xl px-3 sm:px-4">
        <div className="flex items-center gap-2 py-2.5 sm:py-3">
          <Link href="/" className="mr-1 hidden items-center gap-2 sm:flex">
            <span className="text-xl">🗞️</span>
            <span className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-sm font-bold tracking-tight text-transparent dark:from-indigo-400 dark:to-fuchsia-400">
              News Dashboard
            </span>
          </Link>
          <nav className="scrollbar-none flex flex-1 gap-1 overflow-x-auto sm:flex-none">
            {tab("/", "feed", "Feed", "📰")}
            {tab("/discover", "discover", "Discover", "✨")}
            {tab("/saved", "saved", "Saved", "🔖")}
            {tab("/taste", "taste", "You", "📊")}
            {tab("/search", "search", "", "🔍")}
          </nav>
          <div className="ml-auto">
            <RefreshControls
              lastRun={
                lastRun
                  ? {
                      startedAt: lastRun.startedAt.toISOString(),
                      status: lastRun.status,
                      error: lastRun.error,
                    }
                  : null
              }
              autoFetchEnabled={autoFetch !== "false"}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
