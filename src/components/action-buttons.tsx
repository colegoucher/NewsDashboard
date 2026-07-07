"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  itemId: number;
  saved: boolean;
  showDismiss?: boolean;
  /** refresh the route after an action that changes what's visible */
  refreshOnAction?: boolean;
}

export function ActionButtons({ itemId, saved: savedInitial, showDismiss = true, refreshOnAction = false }: Props) {
  const router = useRouter();
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [saved, setSaved] = useState(savedInitial);

  async function send(action: string) {
    await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, action }),
    });
    if (refreshOnAction) router.refresh();
  }

  const btn =
    "rounded-full border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800";
  const activeBtn = "!border-neutral-900 bg-neutral-900 text-white dark:!border-white dark:bg-white dark:text-neutral-900";

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <button
        className={`${btn} ${vote === "up" ? activeBtn : ""}`}
        title="More like this"
        onClick={() => {
          setVote("up");
          send("upvote");
        }}
      >
        ▲
      </button>
      <button
        className={`${btn} ${vote === "down" ? activeBtn : ""}`}
        title="Less like this"
        onClick={() => {
          setVote("down");
          send("downvote");
        }}
      >
        ▼
      </button>
      <button
        className={`${btn} ${saved ? activeBtn : ""}`}
        title={saved ? "Saved" : "Save"}
        onClick={() => {
          setSaved(!saved);
          send(saved ? "unsave" : "save");
        }}
      >
        {saved ? "saved" : "save"}
      </button>
      {showDismiss && (
        <button className={btn} title="Hide from feed" onClick={() => send("dismiss")}>
          ✕
        </button>
      )}
    </div>
  );
}
