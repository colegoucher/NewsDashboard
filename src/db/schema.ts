import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // "rss" | "reddit" | ...
  config: jsonb("config").notNull().$type<Record<string, string>>(), // feedUrl / subreddit / etc.
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const items = pgTable(
  "items",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id),
    title: text("title").notNull(),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    externalId: text("external_id").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    rawContent: text("raw_content"),
    contentStatus: text("content_status").notNull().default("pending"), // "pending" | "full" | "excerpt" | "failed"
    summary: text("summary"),
    category: text("category"),
    tags: jsonb("tags").$type<string[]>(),
  },
  (t) => [
    uniqueIndex("items_source_external_unique").on(t.sourceId, t.externalId),
    index("items_published_idx").on(t.publishedAt),
    index("items_canonical_idx").on(t.canonicalUrl),
  ]
);

export const userActions = pgTable(
  "user_actions",
  {
    id: serial("id").primaryKey(),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id),
    actionType: text("action_type").notNull(), // "upvote" | "downvote" | "save" | "read" | "dismiss"
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("user_actions_item_idx").on(t.itemId)]
);

export const fetchRuns = pgTable("fetch_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull().default("running"), // "running" | "success" | "partial" | "failed"
  trigger: text("trigger").notNull().default("schedule"), // "schedule" | "manual"
  itemsFetched: integer("items_fetched").notNull().default(0),
  itemsSummarized: integer("items_summarized").notNull().default(0),
  error: text("error"),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
