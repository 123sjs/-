import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { trendTopicsTable } from "./trend-topics";

export const candidatesTable = pgTable("candidates", {
  id: serial("id").primaryKey(),
  trendTopicId: integer("trend_topic_id").references(() => trendTopicsTable.id),
  tokenName: text("token_name").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  description: text("description").notNull(),
  narrative: text("narrative"),
  logoUrl: text("logo_url"),
  riskLevel: text("risk_level").notNull().default("medium"),
  scoreTotal: integer("score_total"),
  riskFlags: jsonb("risk_flags"),
  suggestedChain: text("suggested_chain").notNull().default("bsc"),
  status: text("status").notNull().default("pending_review"),
  bscBuyTier: text("bsc_buy_tier"),
  solBuyTier: text("sol_buy_tier"),
  aiRawOutput: jsonb("ai_raw_output"),
  telegramMessageId: integer("telegram_message_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCandidateSchema = createInsertSchema(candidatesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Candidate = typeof candidatesTable.$inferSelect;
