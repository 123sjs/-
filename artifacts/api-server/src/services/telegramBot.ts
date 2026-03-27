import { Telegraf, Markup } from "telegraf";
import type { Candidate, LaunchJob } from "@workspace/db";
import { db } from "@workspace/db";
import {
  candidatesTable,
  launchJobsTable,
  auditLogsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const TELEGRAM_BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"];
const TELEGRAM_ADMIN_CHAT_ID = process.env["TELEGRAM_ADMIN_CHAT_ID"];

let bot: Telegraf | null = null;

export function isTelegramEnabled(): boolean {
  return Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_ADMIN_CHAT_ID);
}

export function getBot(): Telegraf | null {
  return bot;
}

function buildApprovalKeyboard(candidateId: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("🟢 BSC", `approve_bsc:${candidateId}`),
      Markup.button.callback("🟣 SOL", `approve_sol:${candidateId}`),
      Markup.button.callback("⚡ 双链", `approve_both:${candidateId}`),
      Markup.button.callback("⏭ 跳过", `reject:${candidateId}`),
    ],
    [
      Markup.button.callback("BSC 0.1", `set_bsc_buy_safe:${candidateId}`),
      Markup.button.callback("BSC 0.3", `set_bsc_buy_normal:${candidateId}`),
      Markup.button.callback("BSC 0.5", `set_bsc_buy_aggressive:${candidateId}`),
    ],
    [
      Markup.button.callback("SOL 0.05", `set_sol_buy_safe:${candidateId}`),
      Markup.button.callback("SOL 0.1", `set_sol_buy_normal:${candidateId}`),
      Markup.button.callback("SOL 0.2", `set_sol_buy_aggressive:${candidateId}`),
    ],
    [
      Markup.button.callback("✏️ 改名", `rename:${candidateId}`),
      Markup.button.callback("🔤 改符号", `resymbol:${candidateId}`),
      Markup.button.callback("📝 改描述", `redesc:${candidateId}`),
      Markup.button.callback("🚫 拉黑", `blacklist:${candidateId}`),
    ],
  ]);
}

function buildCandidateMessage(candidate: Candidate): string {
  const riskEmoji = { low: "🟢", medium: "🟡", high: "🔴" }[candidate.riskLevel] ?? "⚪";
  const chainEmoji = { bsc: "⟡ BSC", sol: "◎ SOL", both: "⟡ BSC + ◎ SOL" }[candidate.suggestedChain as string] ?? candidate.suggestedChain;

  return [
    `🆕 *候选代币审批*`,
    ``,
    `*名称：* ${escapeMarkdown(candidate.tokenName)}`,
    `*符号：* \`${candidate.tokenSymbol}\``,
    `*描述：* ${escapeMarkdown(candidate.description)}`,
    `*叙事：* ${escapeMarkdown(candidate.narrative ?? "")}`,
    ``,
    `*风险：* ${riskEmoji} ${candidate.riskLevel.toUpperCase()}`,
    `*推荐链：* ${chainEmoji}`,
    `*状态：* \`${candidate.status}\``,
    `*候选ID：* \`${candidate.id}\``,
  ].join("\n");
}

function escapeMarkdown(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

async function writeAuditLog(
  action: string,
  entityType: string,
  entityId: number,
  actor: string,
  metadata?: Record<string, unknown>,
) {
  await db.insert(auditLogsTable).values({
    action,
    entityType,
    entityId,
    actor,
    metadata: metadata ?? null,
  });
}

async function updateCandidateStatus(
  candidateId: number,
  update: Partial<typeof candidatesTable.$inferInsert>,
) {
  await db
    .update(candidatesTable)
    .set({ ...update, updatedAt: new Date() })
    .where(eq(candidatesTable.id, candidateId));
}

async function createLaunchJob(candidateId: number, chain: "bsc" | "sol", buyTier?: string) {
  const [job] = await db
    .insert(launchJobsTable)
    .values({
      candidateId,
      chain,
      status: "pending",
      buyTier: buyTier ?? null,
    })
    .returning();
  return job as LaunchJob;
}

export function initTelegramBot(): void {
  if (!TELEGRAM_BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — Telegram bot disabled");
    return;
  }
  if (!TELEGRAM_ADMIN_CHAT_ID) {
    logger.warn("TELEGRAM_ADMIN_CHAT_ID not set — Telegram bot disabled");
    return;
  }

  bot = new Telegraf(TELEGRAM_BOT_TOKEN);

  bot.command("start", (ctx) => {
    ctx.reply("✅ Anti-MEV Launch Bot ready. Candidates will be sent here for approval.");
  });

  bot.command("status", async (ctx) => {
    const candidates = await db.select().from(candidatesTable);
    const pending = candidates.filter((c) => c.status === "pending_review").length;
    const approved = candidates.filter((c) => c.status.startsWith("approved")).length;
    ctx.reply(`📊 Candidates: ${candidates.length} total | ${pending} pending | ${approved} approved`);
  });

  bot.on("callback_query", async (ctx) => {
    const data = "data" in ctx.callbackQuery ? ctx.callbackQuery.data : "";
    if (!data) return;

    const [action, idStr] = data.split(":");
    const candidateId = Number(idStr);

    if (!action || !candidateId || Number.isNaN(candidateId)) {
      await ctx.answerCbQuery("Invalid action");
      return;
    }

    const [candidate] = await db
      .select()
      .from(candidatesTable)
      .where(eq(candidatesTable.id, candidateId))
      .limit(1);

    if (!candidate) {
      await ctx.answerCbQuery("Candidate not found");
      return;
    }

    try {
      switch (action) {
        case "approve_bsc": {
          await updateCandidateStatus(candidateId, { status: "approved_bsc" });
          const job = await createLaunchJob(candidateId, "bsc", candidate.bscBuyTier ?? undefined);
          await writeAuditLog("candidate_approved_bsc", "candidate", candidateId, "telegram_admin", {
            launchJobId: job.id,
            buyTier: candidate.bscBuyTier,
          });
          await ctx.answerCbQuery("✅ BSC deployment approved");
          await ctx.editMessageText(
            `${buildCandidateMessage({ ...candidate, status: "approved_bsc" })}\n\n✅ *BSC 部署已批准* — Job ID: ${job.id}`,
            { parse_mode: "MarkdownV2" },
          );
          break;
        }

        case "approve_sol": {
          await updateCandidateStatus(candidateId, { status: "approved_sol" });
          const job = await createLaunchJob(candidateId, "sol", candidate.solBuyTier ?? undefined);
          await writeAuditLog("candidate_approved_sol", "candidate", candidateId, "telegram_admin", {
            launchJobId: job.id,
            buyTier: candidate.solBuyTier,
          });
          await ctx.answerCbQuery("✅ SOL deployment approved");
          await ctx.editMessageText(
            `${buildCandidateMessage({ ...candidate, status: "approved_sol" })}\n\n✅ *SOL 部署已批准* — Job ID: ${job.id}`,
            { parse_mode: "MarkdownV2" },
          );
          break;
        }

        case "approve_both": {
          await updateCandidateStatus(candidateId, { status: "approved_both" });
          const bscJob = await createLaunchJob(candidateId, "bsc", candidate.bscBuyTier ?? undefined);
          const solJob = await createLaunchJob(candidateId, "sol", candidate.solBuyTier ?? undefined);
          await writeAuditLog("candidate_approved_both", "candidate", candidateId, "telegram_admin", {
            bscJobId: bscJob.id,
            solJobId: solJob.id,
          });
          await ctx.answerCbQuery("✅ BSC + SOL deployment approved");
          await ctx.editMessageText(
            `${buildCandidateMessage({ ...candidate, status: "approved_both" })}\n\n✅ *双链部署已批准* — BSC: ${bscJob.id} SOL: ${solJob.id}`,
            { parse_mode: "MarkdownV2" },
          );
          break;
        }

        case "reject": {
          await updateCandidateStatus(candidateId, { status: "rejected" });
          await writeAuditLog("candidate_rejected", "candidate", candidateId, "telegram_admin");
          await ctx.answerCbQuery("⏭ Skipped");
          await ctx.editMessageText(
            `${buildCandidateMessage({ ...candidate, status: "rejected" })}\n\n⏭ *已跳过*`,
            { parse_mode: "MarkdownV2" },
          );
          break;
        }

        case "blacklist": {
          await updateCandidateStatus(candidateId, { status: "blacklisted" });
          await writeAuditLog("candidate_blacklisted", "candidate", candidateId, "telegram_admin");
          await ctx.answerCbQuery("🚫 Blacklisted");
          await ctx.editMessageText(
            `${buildCandidateMessage({ ...candidate, status: "blacklisted" })}\n\n🚫 *已拉黑*`,
            { parse_mode: "MarkdownV2" },
          );
          break;
        }

        case "set_bsc_buy_safe":
        case "set_bsc_buy_normal":
        case "set_bsc_buy_aggressive": {
          const tier = action.replace("set_bsc_buy_", "");
          await updateCandidateStatus(candidateId, { bscBuyTier: tier });
          await writeAuditLog("bsc_buy_tier_set", "candidate", candidateId, "telegram_admin", { tier });
          await ctx.answerCbQuery(`BSC 首买设为 ${tier} (${tier === "safe" ? "0.1" : tier === "normal" ? "0.3" : "0.5"} BNB)`);
          await ctx.editMessageText(
            buildCandidateMessage({ ...candidate, bscBuyTier: tier }),
            { parse_mode: "MarkdownV2", reply_markup: buildApprovalKeyboard(candidateId).reply_markup },
          );
          break;
        }

        case "set_sol_buy_safe":
        case "set_sol_buy_normal":
        case "set_sol_buy_aggressive": {
          const tier = action.replace("set_sol_buy_", "");
          await updateCandidateStatus(candidateId, { solBuyTier: tier });
          await writeAuditLog("sol_buy_tier_set", "candidate", candidateId, "telegram_admin", { tier });
          await ctx.answerCbQuery(`SOL 首买设为 ${tier} (${tier === "safe" ? "0.05" : tier === "normal" ? "0.1" : "0.2"} SOL)`);
          await ctx.editMessageText(
            buildCandidateMessage({ ...candidate, solBuyTier: tier }),
            { parse_mode: "MarkdownV2", reply_markup: buildApprovalKeyboard(candidateId).reply_markup },
          );
          break;
        }

        case "rename":
          await ctx.answerCbQuery("请直接回复此消息输入新名称（功能开发中）");
          break;
        case "resymbol":
          await ctx.answerCbQuery("请直接回复此消息输入新符号（功能开发中）");
          break;
        case "redesc":
          await ctx.answerCbQuery("请直接回复此消息输入新描述（功能开发中）");
          break;

        default:
          await ctx.answerCbQuery("Unknown action");
      }
    } catch (err) {
      logger.error({ err: String(err), action, candidateId }, "Telegram callback error");
      await ctx.answerCbQuery("Error: " + String(err).slice(0, 60));
    }
  });

  bot.launch().catch((err) => {
    logger.error({ err: String(err) }, "Telegram bot launch error");
  });

  process.once("SIGINT", () => bot?.stop("SIGINT"));
  process.once("SIGTERM", () => bot?.stop("SIGTERM"));

  logger.info("Telegram bot started (long polling)");
}

export async function sendCandidateForApproval(candidate: Candidate): Promise<boolean> {
  if (!bot || !TELEGRAM_ADMIN_CHAT_ID) return false;

  try {
    const message = await bot.telegram.sendMessage(
      TELEGRAM_ADMIN_CHAT_ID,
      buildCandidateMessage(candidate),
      {
        parse_mode: "MarkdownV2",
        ...buildApprovalKeyboard(candidate.id),
      },
    );

    await db
      .update(candidatesTable)
      .set({ telegramMessageId: message.message_id, updatedAt: new Date() })
      .where(eq(candidatesTable.id, candidate.id));

    await writeAuditLog("candidate_sent_to_telegram", "candidate", candidate.id, "system", {
      messageId: message.message_id,
      chatId: TELEGRAM_ADMIN_CHAT_ID,
    });

    logger.info({ candidateId: candidate.id, messageId: message.message_id }, "Candidate sent to Telegram");
    return true;
  } catch (err) {
    logger.error({ err: String(err), candidateId: candidate.id }, "Failed to send candidate to Telegram");
    return false;
  }
}

export async function sendLaunchResult(job: LaunchJob, tokenName: string): Promise<void> {
  if (!bot || !TELEGRAM_ADMIN_CHAT_ID) return;

  const statusEmoji = job.status === "bought" ? "✅" : job.status === "failed" ? "❌" : "ℹ️";
  const chain = job.chain.toUpperCase();

  const lines = [
    `${statusEmoji} *发射结果* — ${escapeMarkdown(tokenName)}`,
    `*链：* ${chain}`,
    `*状态：* \`${job.status}\``,
    job.contractAddress ? `*合约：* \`${job.contractAddress}\`` : null,
    job.deployTxHash ? `*部署TX：* \`${job.deployTxHash.slice(0, 16)}\\.\\.\\.\`` : null,
    job.buyTxHash ? `*首买TX：* \`${job.buyTxHash.slice(0, 16)}\\.\\.\\.\`` : null,
    job.buyAmount ? `*首买额：* ${job.buyAmount}` : null,
    job.errorMessage ? `*错误：* ${escapeMarkdown(job.errorMessage.slice(0, 100))}` : null,
  ].filter(Boolean).join("\n");

  try {
    await bot.telegram.sendMessage(TELEGRAM_ADMIN_CHAT_ID, lines, { parse_mode: "MarkdownV2" });
  } catch (err) {
    logger.error({ err: String(err) }, "Failed to send launch result to Telegram");
  }
}
