import { db } from "@workspace/db";
import {
  trendTopicsTable,
  candidatesTable,
  auditLogsTable,
} from "@workspace/db";
import { desc } from "drizzle-orm";
import { generateCandidate } from "../services/aiGenerator";
import { generateTokenLogo } from "../services/imageGenerator";
import { checkCandidateRisk } from "../services/riskEngine";
import { logger } from "../lib/logger";

export interface BuildCandidatesResult {
  ok: boolean;
  processed?: number;
  created?: number;
  skipped?: number;
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
      return { ok: true, processed: 0, created: 0, skipped: 0, errors: [] };
    }

    let created = 0;
    let skipped = 0;
    const errors: Array<{ topic: string; error: string }> = [];

    logger.info({ 话题总数: topics.length }, "【候选生成】开始处理话题列表");

    for (const topic of topics) {
      try {
        logger.info({ 话题: topic.topic }, "【候选生成】正在生成 AI 候选");

        const payload = await generateCandidate(topic.topic);

        const riskResult = checkCandidateRisk(
          payload.tokenName,
          payload.tokenSymbol,
          payload.description,
          payload.narrative,
          topic.topic,
        );

        if (!riskResult.passed) {
          skipped++;
          logger.warn(
            { 话题: topic.topic, 代币名: payload.tokenName, 拦截原因: riskResult.flags },
            "【风控】候选被拦截",
          );

          await db.insert(auditLogsTable).values({
            action: "candidate_risk_blocked",
            entityType: "trend_topic",
            entityId: topic.id,
            actor: "risk_engine",
            metadata: {
              topic: topic.topic,
              tokenName: payload.tokenName,
              tokenSymbol: payload.tokenSymbol,
              riskFlags: riskResult.flags,
              riskScore: riskResult.score,
            },
          });

          continue;
        }

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
            scoreTotal: riskResult.score,
            riskFlags: riskResult.flags.length > 0 ? riskResult.flags : null,
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
            riskFlags: riskResult.flags,
          },
        });

        created++;
        logger.info(
          { candidateId: candidate!.id, 代币名: payload.tokenName, 符号: payload.tokenSymbol },
          "【候选生成】新候选已入库",
        );
      } catch (err) {
        const errorMsg = String(err);
        errors.push({ topic: topic.topic, error: errorMsg });
        logger.error({ err: errorMsg, 话题: topic.topic }, "【候选生成】生成失败");

        await db.insert(auditLogsTable).values({
          action: "candidate_generation_failed",
          entityType: "trend_topic",
          entityId: topic.id,
          actor: "system",
          metadata: { topic: topic.topic, error: errorMsg },
        });
      }
    }

    logger.info(
      { 处理话题数: topics.length, 新建候选数: created, 风控拦截数: skipped, 错误数: errors.length },
      "【候选生成】本轮结束：抓取话题 → 生成候选 → 风控过滤 完成",
    );

    return { ok: true, processed: topics.length, created, skipped, errors };
  } catch (err) {
    const error = String(err);
    logger.error({ err: error }, "【候选生成】整体任务失败");
    return { ok: false, error };
  }
}
