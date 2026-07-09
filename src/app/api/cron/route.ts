import { NextRequest, NextResponse } from "next/server";

// Vercel cron hits this daily (vercel.json) as a second, independent
// scheduler alongside GitHub's crons, which have skipped mornings under
// load. It dispatches the pipeline workflow with SCHEDULED semantics —
// the pipeline's own 3h idempotence guard and auto-fetch toggle apply, so
// even hostile spam of this endpoint can cause at most one run per 3 hours.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorized = secret
    ? req.headers.get("authorization") === `Bearer ${secret}`
    : (req.headers.get("user-agent") ?? "").includes("vercel-cron");
  if (!authorized) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !token) {
    return NextResponse.json({ error: "GITHUB_REPO / GITHUB_TOKEN not configured" }, { status: 500 });
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
      body: JSON.stringify({ ref: "main", inputs: { manual: "false" } }),
    }
  );

  if (res.status !== 204) {
    return NextResponse.json({ error: `dispatch failed (${res.status})` }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
