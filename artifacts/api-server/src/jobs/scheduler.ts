import cron from "node-cron";
import { logger } from "../lib/logger";
import { runCollectTrends } from "./collectTrends";
import { runBuildCandidates } from "./buildCandidates";
import { db } from "@workspace/db";
import { candidatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendCandidateForApproval, isTelegramEnabled } from "../services/telegramBot";

let schedulerStarted = false;

/**
 * 内存级发送去重：记录每个候选最近一次尝试发送的时间。
 * 若上次失败距今不足 SEND_RETRY_INTERVAL_MS，则跳过，避免因 chat id 配置错误刷屏。
 */
const lastSendAttemptMs = new Map<number, number>();
const SEND_RETRY_INTERVAL_MS = 15 * 60 * 1000; // 15 分钟内不重试同一候选

export function startScheduler(): void {
  if (schedulerStarted) {
    logger.warn("调度器已在运行，忽略重复启动请求");
    return;
  }
  schedulerStarted = true;

  // 每 10 分钟采集 X 热点
  cron.schedule("*/10 * * * *", async () => {
    logger.info("【热点采集】开始采集 X 热点话题");
    const result = await runCollectTrends();
    if (result.ok) {
      logger.info({ 已保存: result.saved, 来源: result.source }, "【热点采集】完成");
    } else {
      logger.error({ error: result.error }, "【热点采集】失败");
    }
  });

  // 每 15 分钟生成 AI 候选（偏移 5 分钟，在热点采集后执行）
  cron.schedule("5,20,35,50 * * * *", async () => {
    logger.info("【候选生成】开始生成 AI 候选代币");
    const result = await runBuildCandidates(3);
    if (result.ok) {
      logger.info(
        { 处理话题数: result.processed, 新建候选数: result.created, 风控拦截数: result.skipped, 错误数: result.errors?.length ?? 0 },
        "【候选生成】完成",
      );
    } else {
      logger.error({ error: result.error }, "【候选生成】失败");
    }
  });

  // 每 5 分钟向 Telegram 发送待审核候选
  cron.schedule("*/5 * * * *", async () => {
    if (!isTelegramEnabled()) return;

    try {
      const pending = await db
        .select()
        .from(candidatesTable)
        .where(eq(candidatesTable.status, "pending_review"));

      // 过滤：已发送的（有 telegramMessageId）跳过；最近刚重试过的也跳过
      const now = Date.now();
      const toSend = pending.filter((c) => {
        if (c.telegramMessageId) return false;
        const lastAttempt = lastSendAttemptMs.get(c.id);
        if (lastAttempt && now - lastAttempt < SEND_RETRY_INTERVAL_MS) return false;
        return true;
      });

      if (toSend.length === 0) return;

      logger.info({ 待发送数: toSend.length, 总待审核数: pending.length }, "【Telegram 通知】开始发送");

      let sentOk = 0;
      let sentFail = 0;
      for (const candidate of toSend) {
        lastSendAttemptMs.set(candidate.id, Date.now());
        const ok = await sendCandidateForApproval(candidate);
        if (ok) sentOk++;
        else sentFail++;
      }

      logger.info({ 发送成功: sentOk, 发送失败: sentFail }, "【Telegram 通知】本轮完成");
    } catch (err) {
      logger.error({ err: String(err) }, "【Telegram 通知】定时任务异常");
    }
  });

  logger.info("调度器已启动：热点采集 每10分钟 | 候选生成 每15分钟 | Telegram通知 每5分钟");
}
