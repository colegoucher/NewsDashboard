import { lookup } from "node:dns/promises";
import net from "node:net";

// Defense-in-depth for server-side fetches. Everything here is behind
// single-user auth, so the practical threat is low — but any endpoint that
// fetches a user-influenced URL (feed discovery, article re-fetch) should
// refuse to hit internal/loopback/link-local/metadata addresses.

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) || // link-local + cloud metadata (169.254.169.254)
      a === 0 ||
      a >= 224 // multicast/reserved
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    // IPv4-mapped (::ffff:a.b.c.d) — re-check the embedded v4 address.
    if (v.startsWith("::ffff:") && v.includes(".")) {
      return isPrivateIp(v.slice("::ffff:".length));
    }
    return (
      v === "::1" || // loopback
      v === "::" ||
      v.startsWith("fc") ||
      v.startsWith("fd") || // unique-local
      v.startsWith("fe80") // link-local
    );
  }
  return true; // unknown format -> refuse
}

/**
 * Throws if the URL isn't a public http(s) resource. Resolves DNS and checks
 * every returned address, so a hostname pointing at a private IP is rejected.
 */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("only http(s) URLs are allowed");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost") throw new Error("blocked host");

  // If it's already an IP literal, check directly; otherwise resolve.
  const addrs = net.isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (addrs.length === 0) throw new Error("host did not resolve");
  for (const addr of addrs) {
    if (isPrivateIp(addr)) throw new Error("blocked non-public address");
  }
  return url;
}
