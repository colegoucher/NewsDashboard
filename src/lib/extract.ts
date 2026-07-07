import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";
import { assertPublicUrl } from "./ssrf";

export interface ExtractionResult {
  text: string | null;
  status: "full" | "failed";
  imageUrl: string | null; // og:image if the page declares one
}

const MAX_CONTENT_CHARS = 40_000; // plenty for summarization/Q&A, keeps rows small

/**
 * Fetch a URL and extract readable article text. Failure is a normal outcome
 * (paywalls, JS-rendered pages, bot blocking) — callers fall back to the
 * source-provided excerpt and record content_status accordingly.
 */
export async function extractArticle(url: string): Promise<ExtractionResult> {
  try {
    await assertPublicUrl(url);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { text: null, status: "failed", imageUrl: null };
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) return { text: null, status: "failed", imageUrl: null };

    const html = await res.text();
    const imageUrl = extractOgImage(html, url);

    // jsdom logs noisy CSS-parse errors on real-world pages; silence them.
    const virtualConsole = new VirtualConsole();
    const dom = new JSDOM(html, { url, virtualConsole });
    const article = new Readability(dom.window.document).parse();

    const text = article?.textContent?.replace(/\s+/g, " ").trim();
    if (!text || text.length < 300) return { text: null, status: "failed", imageUrl };
    return { text: text.slice(0, MAX_CONTENT_CHARS), status: "full", imageUrl };
  } catch {
    return { text: null, status: "failed", imageUrl: null };
  }
}

function extractOgImage(html: string, baseUrl: string): string | null {
  const head = html.slice(0, 50_000);
  const match =
    head.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    head.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ??
    head.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  if (!match) return null;
  try {
    const resolved = new URL(match[1], baseUrl).toString();
    return resolved.startsWith("http") ? resolved : null;
  } catch {
    return null;
  }
}
