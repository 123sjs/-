import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const trendTopicsTable = pgTable("trend_topics", {
  id: serial("id").primaryKey(),
  topic: text("topic").notNull(),
  source: text("source").notNull().default("x_trends"),
  region: text("region").notNull().default("global"),
  volume: integer("volume"),
  rawData: jsonb("raw_data"),
  collectedAt: timestamp("collected_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTrendTopicSchema = createInsertSchema(trendTopicsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTrendTopic = z.infer<typeof insertTrendTopicSchema>;
export type TrendTopic = typeof trendTopicsTable.$inferSelect;
