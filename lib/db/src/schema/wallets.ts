import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const walletsTable = pgTable("wallets", {
  id: serial("id").primaryKey(),
  chain: text("chain").notNull(),
  role: text("role").notNull(),
  address: text("address").notNull(),
  encryptedPrivKey: text("encrypted_priv_key"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWalletSchema = createInsertSchema(walletsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof walletsTable.$inferSelect;
