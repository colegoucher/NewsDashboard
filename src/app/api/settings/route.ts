import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setSetting } from "@/lib/settings";

const ALLOWED_KEYS = ["auto_fetch_enabled"];

const bodySchema = z.object({
  key: z.string(),
  value: z.string().max(100),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !ALLOWED_KEYS.includes(parsed.data.key)) {
    return NextResponse.json({ error: "invalid setting" }, { status: 400 });
  }
  await setSetting(parsed.data.key, parsed.data.value);
  return NextResponse.json({ ok: true });
}
