import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";

export interface ExtractionResult {
  text: string | null;
  status: "full" | "failed";
}

const MAX_CONTENT_CHARS = 40_000; // plenty for summarization/Q&A, keeps rows small

/**
 * Fetch a URL and extract readable article text. Failure is a normal outcome
 * (paywalls, JS-rendered pages, bot blocking) — callers fall back to the
 * source-provided excerpt and record content_status accordingly.
 */
export async function extractArticle(url: string): Promise<ExtractionResult> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { text: null, status: "failed" };
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) return { text: null, status: "failed" };

    const html = await res.text();
    // jsdom logs noisy CSS-parse errors on real-world pages; silence them.
    const virtualConsole = new VirtualConsole();
    const dom = new JSDOM(html, { url, virtualConsole });
    const article = new Readability(dom.window.document).parse();

    const text = article?.textContent?.replace(/\s+/g, " ").trim();
    if (!text || text.length < 300) return { text: null, status: "failed" };
    return { text: text.slice(0, MAX_CONTENT_CHARS), status: "full" };
  } catch {
    return { text: null, status: "failed" };
  }
}
