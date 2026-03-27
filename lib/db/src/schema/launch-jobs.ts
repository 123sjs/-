import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { candidatesTable } from "./candidates";

export const launchJobsTable = pgTable("launch_jobs", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id")
    .notNull()
    .references(() => candidatesTable.id),
  chain: text("chain").notNull(),
  status: text("status").notNull().default("pending"),
  platform: text("platform"),
  platformUrl: text("platform_url"),
  launchMode: text("launch_mode"),
  deepLink: text("deep_link"),
  instructions: text("instructions"),
  opsWalletLabel: text("ops_wallet_label"),
  contractAddress: text("contract_address"),
  deployTxHash: text("deploy_tx_hash"),
  buyTxHash: text("buy_tx_hash"),
  buyAmount: text("buy_amount"),
  buyTier: text("buy_tier"),
  errorMessage: text("error_message"),
  deployedAt: timestamp("deployed_at"),
  boughtAt: timestamp("bought_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLaunchJobSchema = createInsertSchema(launchJobsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLaunchJob = z.infer<typeof insertLaunchJobSchema>;
export type LaunchJob = typeof launchJobsTable.$inferSelect;
