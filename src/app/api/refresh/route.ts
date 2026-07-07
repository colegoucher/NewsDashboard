import { NextResponse } from "next/server";

// The pipeline is too slow for a serverless function (Gemini rate limits mean
// minutes of wall-clock time), so Refresh dispatches the GitHub Actions
// workflow instead of running the work here.
export async function POST() {
  const repo = process.env.GITHUB_REPO; // "owner/name"
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !token) {
    return NextResponse.json(
      { error: "GITHUB_REPO / GITHUB_TOKEN not configured" },
      { status: 500 }
    );
  }

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/pipeline.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: "main" }),
    }
  );

  if (res.status !== 204) {
    const body = await res.text();
    return NextResponse.json(
      { error: `workflow dispatch failed (${res.status}): ${body.slice(0, 200)}` },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true });
}
