import { GoogleGenAI } from "@google/genai";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { settings } from "@/db/schema";
import {
  BATCH_CONTENT_CHARS,
  GEMINI_DAILY_BUDGET,
  GEMINI_MAX_RPM,
  GEMINI_MODELS,
  GROQ_MODELS,
} from "./config";
import { getCategories } from "./categories";

// All Gemini access goes through this module: one place for rate limiting,
// the daily budget, the model fallback chain, and provider swap if the free
// tier ever changes again.
//
// Free-tier reality (post-Dec-2025): daily quotas can be as low as ~20
// requests per model per day. Two countermeasures live here:
//  - generate() walks GEMINI_MODELS in order, skipping models whose daily
//    quota is spent (quotas are per-model, so each model is fresh headroom)
//  - summarizeBatch() packs many articles into one call

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set");
    client = new GoogleGenAI({ apiKey: key });
  }
  return client;
}

// ---- daily budget (shared across pipeline and Ask-AI, persisted in settings) ----

function todayKey(): string {
  return `gemini_calls_${new Date().toISOString().slice(0, 10)}`;
}

export class BudgetExceededError extends Error {
  constructor(message = "Gemini daily budget/quota exceeded") {
    super(message);
  }
}

async function consumeBudget(): Promise<void> {
  const key = todayKey();
  const [row] = await db
    .insert(settings)
    .values({ key, value: "1" })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: sql`(${settings.value}::int + 1)::text`, updatedAt: sql`now()` },
    })
    .returning({ value: settings.value });
  if (Number(row.value) > GEMINI_DAILY_BUDGET) throw new BudgetExceededError();
}

// ---- rate limiting (process-local; the pipeline is the only bulk caller) ----

let lastCallAt = 0;
async function rateLimit(): Promise<void> {
  const minInterval = Math.ceil(60_000 / GEMINI_MAX_RPM);
  const wait = lastCallAt + minInterval - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

// ---- provider/model fallback chain ----
// Gemini models first (best quality), then Groq models as deep overflow
// (free tier is ~25-350x Gemini's). Each entry has its own daily quota.

interface ChainEntry {
  provider: "gemini" | "groq";
  model: string;
}

function providerChain(): ChainEntry[] {
  const chain: ChainEntry[] = GEMINI_MODELS.map((m) => ({ provider: "gemini" as const, model: m }));
  if (process.env.GROQ_API_KEY) {
    chain.push(...GROQ_MODELS.map((m) => ({ provider: "groq" as const, model: m })));
  }
  return chain;
}

async function callGemini(model: string, prompt: string, jsonSchema?: object): Promise<string> {
  const res = await getClient().models.generateContent({
    model,
    contents: prompt,
    config: jsonSchema
      ? { responseMimeType: "application/json", responseSchema: jsonSchema }
      : undefined,
  });
  const text = res.text;
  if (!text) throw new Error("empty Gemini response");
  return text;
}

async function callGroq(model: string, prompt: string, jsonSchema?: object): Promise<string> {
  // OpenAI-compatible endpoint. json_object mode requires the word JSON in
  // the prompt, so the schema is inlined as an instruction.
  const content = jsonSchema
    ? `${prompt}\n\nRespond with ONLY a valid JSON object matching this JSON Schema (no prose, no markdown fences):\n${JSON.stringify(jsonSchema)}`
    : prompt;
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      ...(jsonSchema ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    throw new Error(`groq ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  let text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("empty groq response");
  // Strip markdown fences if the model added them despite instructions.
  text = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return text;
}

// Process-local; a fresh pipeline run re-probes all models.
const modelState = new Map<string, "exhausted" | "unavailable">();

const MAX_RETRIES = 3;

async function generate(prompt: string, jsonSchema?: object): Promise<string> {
  for (const { provider, model } of providerChain()) {
    const key = `${provider}:${model}`;
    if (modelState.has(key)) continue;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await consumeBudget();
      await rateLimit();
      try {
        return provider === "gemini"
          ? await callGemini(model, prompt, jsonSchema)
          : await callGroq(model, prompt, jsonSchema);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);

        // Daily quota spent for this model -> mark it and move down the chain.
        if (/PerDay|per day|RPD|TPD/i.test(msg)) {
          modelState.set(key, "exhausted");
          console.log(`llm: ${key} daily quota exhausted, trying next`);
          break;
        }
        // Model doesn't exist (retired/renamed) -> skip it permanently this run.
        if (/NOT_FOUND|404|model_not_found|decommissioned/i.test(msg)) {
          modelState.set(key, "unavailable");
          console.log(`llm: ${key} not available, trying next`);
          break;
        }
        // Per-minute limit or transient overload -> wait and retry same model.
        const retryable = /RESOURCE_EXHAUSTED|429|UNAVAILABLE|503|rate.?limit/i.test(msg);
        if (!retryable || attempt >= MAX_RETRIES) throw e;
        const suggested = msg.match(/(?:retry|try again) in ([\d.]+)s/i);
        const delayMs = suggested
          ? Math.ceil(Number(suggested[1]) * 1000) + 1000
          : 15_000 * (attempt + 1);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw new BudgetExceededError("all AI providers exhausted or unavailable for today");
}

// ---- batched summarize + categorize ----

export interface BatchArticle {
  id: number;
  title: string;
  sourceName: string;
  content: string;
  isExcerptOnly: boolean;
}

export interface SummarizeResult {
  summary: string;
  category: string;
  tags: string[];
}

const batchSchema = z.object({
  results: z.array(
    z.object({
      id: z.number(),
      summary: z.string(),
      category: z.string(),
      tags: z.array(z.string()),
    })
  ),
});

export async function summarizeBatch(
  articles: BatchArticle[]
): Promise<Map<number, SummarizeResult>> {
  const categories = await getCategories();
  const prompt = [
    `Below are ${articles.length} articles for a personal news dashboard. For EACH article, produce a summary that is the primary reading experience — it should let the reader fully absorb the story without clicking through.`,
    `Per article return: its "id" exactly as given; a summary of 2-4 tight paragraphs of plain prose (no headers; lead with the core news); exactly one category from this list: ${categories.join(", ")}; and 1-4 short topical tags (lowercase, e.g. "rust", "openai", "chips").`,
    `Articles marked EXCERPT-ONLY had incomplete text available: summarize only what is present, proportionally shorter, without inventing details.`,
    ``,
    ...articles.map((a) =>
      [
        `=== ARTICLE id=${a.id} ${a.isExcerptOnly ? "(EXCERPT-ONLY)" : ""} ===`,
        `Source: ${a.sourceName}`,
        `Title: ${a.title}`,
        a.content.slice(0, BATCH_CONTENT_CHARS),
        ``,
      ].join("\n")
    ),
  ].join("\n");

  const raw = await generate(prompt, {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "number" },
            summary: { type: "string" },
            category: { type: "string", enum: categories },
            tags: { type: "array", items: { type: "string" } },
          },
          required: ["id", "summary", "category", "tags"],
        },
      },
    },
    required: ["results"],
  });

  const knownIds = new Set(articles.map((a) => a.id));
  const out = new Map<number, SummarizeResult>();
  for (const r of batchSchema.parse(JSON.parse(raw)).results) {
    if (!knownIds.has(r.id)) continue;
    out.set(r.id, {
      summary: r.summary,
      category: categories.includes(r.category) ? r.category : "Other",
      tags: r.tags.slice(0, 4),
    });
  }
  return out;
}

// ---- Ask-AI ----

export async function askAboutArticle(input: {
  title: string;
  content: string;
  contentStatus: string;
  question: string;
  history: { role: "user" | "assistant"; text: string }[];
}): Promise<string> {
  const historyBlock = input.history
    .map((m) => `${m.role === "user" ? "Q" : "A"}: ${m.text}`)
    .join("\n");
  const prompt = [
    `You are answering questions about a news article for its reader. Answer from the article text below. If the answer isn't in the text, say so plainly — do not invent details.`,
    input.contentStatus !== "full"
      ? `NOTE: only a partial excerpt of the article is available; caveat answers accordingly.`
      : ``,
    ``,
    `Article title: ${input.title}`,
    `Article text:\n${input.content}`,
    ``,
    historyBlock ? `Previous exchange:\n${historyBlock}\n` : ``,
    `Question: ${input.question}`,
  ].join("\n");

  return generate(prompt);
}

// ---- Discover taste reasoning ----

const discoverSchema = z.object({
  picks: z.array(z.object({ itemId: z.number(), reason: z.string() })),
});

export async function pickDiscoverItems(input: {
  tasteSummary: string;
  candidates: { id: number; title: string; category: string | null; sourceName: string }[];
}): Promise<{ itemId: number; reason: string }[]> {
  const prompt = [
    `You are curating a "Maybe I'd Like" section of a personal news dashboard.`,
    `Reader's taste profile (derived from their voting/reading history):`,
    input.tasteSummary,
    ``,
    `From the candidate items below, pick up to 8: mostly good fits for their taste, but include 1-2 that are genuinely interesting departures from their usual lane (label those honestly in the reason).`,
    `For each pick give a one-sentence reason written to the reader ("Because you...").`,
    ``,
    `Candidates:`,
    ...input.candidates.map(
      (c) => `id=${c.id} [${c.category ?? "?"}] (${c.sourceName}) ${c.title}`
    ),
  ].join("\n");

  const raw = await generate(prompt, {
    type: "object",
    properties: {
      picks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            itemId: { type: "number" },
            reason: { type: "string" },
          },
          required: ["itemId", "reason"],
        },
      },
    },
    required: ["picks"],
  });

  const validIds = new Set(input.candidates.map((c) => c.id));
  return discoverSchema
    .parse(JSON.parse(raw))
    .picks.filter((p) => validIds.has(p.itemId))
    .slice(0, 8);
}
