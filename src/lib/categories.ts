import { getSetting, setSetting } from "./settings";

// Categories are DB-backed so adding a topic never requires a code change.
// "Other" is always present as the summarizer's fallback bucket.

export const DEFAULT_CATEGORIES = [
  "Programming",
  "AI & ML",
  "Tech News",
  "World News",
  "Other",
];

export async function getCategories(): Promise<string[]> {
  const raw = await getSetting("categories");
  const list: string[] = raw ? JSON.parse(raw) : DEFAULT_CATEGORIES;
  return list.includes("Other") ? list : [...list, "Other"];
}

export async function addCategory(name: string): Promise<void> {
  const list = await getCategories();
  if (list.some((c) => c.toLowerCase() === name.toLowerCase())) return;
  const withoutOther = list.filter((c) => c !== "Other");
  await setSetting("categories", JSON.stringify([...withoutOther, name, "Other"]));
}
