import Link from "next/link";
import { getLastRun } from "@/lib/queries";
import { getSetting } from "@/lib/settings";
import { RefreshControls } from "./refresh-controls";

export async function Nav({ active }: { active: "feed" | "discover" | "saved" }) {
  const [lastRun, autoFetch] = await Promise.all([getLastRun(), getSetting("auto_fetch_enabled")]);

  const tab = (href: string, key: string, label: string) => (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-sm font-medium ${
        active === key
          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          : "text-neutral-600 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-800"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
        <nav className="flex gap-1">
          {tab("/", "feed", "Feed")}
          {tab("/discover", "discover", "Discover")}
          {tab("/saved", "saved", "Saved")}
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
    </header>
  );
}
