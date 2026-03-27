import { db } from "@workspace/db";
import {
  trendTopicsTable,
  candidatesTable,
  auditLogsTable,
} from "@workspace/db";
import { desc } from "drizzle-orm";
import { generateCandidate } from "../services/aiGenerator";
import { generateTokenLogo } from "../services/imageGenerator";
import { logger } from "../lib/logger";

export interface BuildCandidatesResult {
  ok: boolean;
  processed?: number;
  created?: number;
  errors?: Array<{ topic: string; error: string }>;
  error?: string;
}

export async function runBuildCandidates(limitTopics = 5): Promise<BuildCandidatesResult> {
  try {
    const topics = await db
      .select()
      .from(trendTopicsTable)
      .orderBy(desc(trendTopicsTable.collectedAt))
      .limit(limitTopics);

    if (topics.length === 0) {
      return { ok: true, processed: 0, created: 0, errors: [] };
    }

    let created = 0;
    const errors: Array<{ topic: string; error: string }> = [];

    for (const topic of topics) {
      try {
        logger.info({ topic: topic.topic }, "Generating candidate for topic");

        const payload = await generateCandidate(topic.topic);

        const logoUrl = await generateTokenLogo(
          payload.tokenName,
          payload.tokenSymbol,
          payload.narrative,
        );

        const [candidate] = await db
          .insert(candidatesTable)
          .values({
            trendTopicId: topic.id,
            tokenName: payload.tokenName,
            tokenSymbol: payload.tokenSymbol,
            description: payload.description,
            narrative: payload.narrative,
            logoUrl,
            riskLevel: payload.riskLevel,
            suggestedChain: payload.suggestedChain,
            status: "pending_review",
            aiRawOutput: payload as unknown as Record<string, unknown>,
          })
          .returning();

        await db.insert(auditLogsTable).values({
          action: "candidate_generated",
          entityType: "candidate",
          entityId: candidate!.id,
          actor: "system",
          metadata: {
            trendTopicId: topic.id,
            topic: topic.topic,
            tokenName: payload.tokenName,
            tokenSymbol: payload.tokenSymbol,
          },
        });

        created++;
        logger.info(
          { candidateId: candidate!.id, tokenName: payload.tokenName },
          "Candidate created",
        );
      } catch (err) {
        const errorMsg = String(err);
        errors.push({ topic: topic.topic, error: errorMsg });
        logger.error({ err: errorMsg, topic: topic.topic }, "Failed to generate candidate");

        await db.insert(auditLogsTable).values({
          action: "candidate_generation_failed",
          entityType: "trend_topic",
          entityId: topic.id,
          actor: "system",
          metadata: { topic: topic.topic, error: errorMsg },
        });
      }
    }

    return { ok: true, processed: topics.length, created, errors };
  } catch (err) {
    const error = String(err);
    logger.error({ err: error }, "Build candidates job failed");
    return { ok: false, error };
  }
}
