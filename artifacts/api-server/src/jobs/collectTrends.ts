import { collectTrends } from "../services/xTrends";
import { logger } from "../lib/logger";

export async function runCollectTrends(): Promise<{
  ok: boolean;
  saved?: number;
  source?: string;
  topics?: string[];
  error?: string;
}> {
  try {
    logger.info("Starting trend collection job");
    const result = await collectTrends();
    logger.info({ result }, "Trend collection job complete");
    return { ok: true, ...result };
  } catch (err) {
    const error = String(err);
    logger.error({ err: error }, "Trend collection job failed");
    return { ok: false, error };
  }
}
