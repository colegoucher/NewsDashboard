const STRIP_PARAMS = /^(utm_|fbclid|gclid|ref_|mc_cid|mc_eid|igshid)/;

/** Normalize a URL for dedup: lowercase host, strip tracking params, hash, trailing slash. */
export function canonicalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    const keep = [...u.searchParams.entries()].filter(([k]) => !STRIP_PARAMS.test(k.toLowerCase()));
    u.search = "";
    for (const [k, v] of keep) u.searchParams.append(k, v);
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return raw;
  }
}
