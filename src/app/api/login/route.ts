import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionTokenForPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const expected = process.env.APP_PASSWORD;

  if (!expected) {
    return NextResponse.json({ error: "APP_PASSWORD not configured" }, { status: 500 });
  }
  if (!password || password !== expected) {
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
