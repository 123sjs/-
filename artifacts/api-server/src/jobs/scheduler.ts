import cron from "node-cron";
import { logger } from "../lib/logger";
import { runCollectTrends } from "./collectTrends";
import { runBuildCandidates } from "./buildCandidates";
import { db } from "@workspace/db";
import { candidatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendCandidateForApproval, isTelegramEnabled } from "../services/telegramBot";

let schedulerStarted = false;

export function startScheduler(): void {
  if (schedulerStarted) {
    logger.warn("Scheduler already started");
    return;
  }
  schedulerStarted = true;

  // Collect X trends every 10 minutes
  cron.schedule("*/10 * * * *", async () => {
    logger.info("Cron: starting trend collection");
    const result = await runCollectTrends();
    if (result.ok) {
      logger.info({ saved: result.saved, source: result.source }, "Cron: trends collected");
    } else {
      logger.error({ error: result.error }, "Cron: trend collection failed");
    }
  });

  // Generate AI candidates every 15 minutes (offset by 5 min after trends)
  cron.schedule("5,20,35,50 * * * *", async () => {
    logger.info("Cron: starting candidate generation");
    const result = await runBuildCandidates(3);
    if (result.ok) {
      logger.info({ created: result.created, processed: result.processed }, "Cron: candidates generated");
    } else {
      logger.error({ error: result.error }, "Cron: candidate generation failed");
    }
  });

  // Send pending candidates to Telegram every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    if (!isTelegramEnabled()) return;

    try {
      const pending = await db
        .select()
        .from(candidatesTable)
        .where(eq(candidatesTable.status, "pending_review"));

      const unnotified = pending.filter((c) => !c.telegramMessageId);
      if (unnotified.length === 0) return;

      logger.info({ count: unnotified.length }, "Cron: sending unnotified candidates to Telegram");
      for (const candidate of unnotified) {
        await sendCandidateForApproval(candidate);
      }
    } catch (err) {
      logger.error({ err: String(err) }, "Cron: Telegram notification failed");
    }
  });

  logger.info("Scheduler started: trend collection every 10min, candidates every 15min, Telegram notify every 5min");
}
