import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionTokenForPassword } from "@/lib/auth";
import { rateLimit, sweepRateLimits } from "@/lib/rate-limit";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: NextRequest) {
  sweepRateLimits();
  // Throttle brute force: 10 attempts / 15 min per client IP.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!rateLimit(`login:${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many attempts — try again in a few minutes." },
      { status: 429 }
    );
  }

  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const expected = process.env.APP_PASSWORD;

  if (!expected) {
    return NextResponse.json({ error: "APP_PASSWORD not configured" }, { status: 500 });
  }
  if (!password || !timingSafeEqual(password, expected)) {
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionTokenForPassword(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return res;
}
