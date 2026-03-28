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

/** ADMIN_CHAT_ID 只有为纯数字时才真正合法（群组为负数） */
function isValidChatId(id: string | undefined): boolean {
  return Boolean(id && /^-?\d+$/.test(id.trim()));
}

/** 审批消息发送是否可用：Token 已设置 且 ADMIN_CHAT_ID 合法 */
const APPROVAL_ENABLED = Boolean(TELEGRAM_BOT_TOKEN) && isValidChatId(TELEGRAM_ADMIN_CHAT_ID);

let bot: Telegraf | null = null;
let botInitialized = false;

type PendingField = "tokenName" | "tokenSymbol" | "description";
interface PendingInput {
  candidateId: number;
  field: PendingField;
  promptMessageId: number;
  timestamp: number;
}

const pendingInputs = new Map<string, PendingInput>();
const INPUT_TIMEOUT_MS = 5 * 60 * 1000;

const FIELD_LABELS: Record<PendingField, string> = {
  tokenName: "名称 (2–20 字符)",
  tokenSymbol: "符号 (2–8 大写字母，如 DOGE)",
  description: "描述 (10–300 字符)",
};

const FIELD_PROMPTS: Record<PendingField, string> = {
  tokenName: "✏️ 请输入新的代币*名称*（2–20 字符），直接发送文字即可：",
  tokenSymbol: "🔤 请输入新的代币*符号*（2–8 大写字母），如 `DOGE`：",
  description: "📝 请输入新的代币*描述*（10–300 字符）：",
};

function validateFieldInput(field: PendingField, value: string): string | null {
  if (field === "tokenName") {
    if (value.length < 2 || value.length > 20) return "名称必须 2–20 字符";
  } else if (field === "tokenSymbol") {
    if (!/^[A-Z]{2,8}$/.test(value)) return "符号必须 2–8 大写英文字母（如 DOGE）";
  } else if (field === "description") {
    if (value.length < 10 || value.length > 300) return "描述必须 10–300 字符";
  }
  return null;
}

/** 机器人是否已启动（用于 /chatid 等命令） */
export function isTelegramEnabled(): boolean {
  return Boolean(TELEGRAM_BOT_TOKEN);
}

/** 审批消息是否可以发送（Token 有效 + ADMIN_CHAT_ID 合法数字） */
export function isApprovalEnabled(): boolean {
  return APPROVAL_ENABLED && bot !== null;
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
  const chainEmoji = { bsc: "⟡ BSC", sol: "◎ SOL", both: "⟡ BSC \\+ ◎ SOL" }[candidate.suggestedChain as string] ?? candidate.suggestedChain;

  const scoreStr = (candidate as Record<string, unknown>)["scoreTotal"]
    ? ` \\| Score: ${(candidate as Record<string, unknown>)["scoreTotal"]}`
    : "";

  return [
    `🆕 *候选代币审批*`,
    ``,
    `*名称：* ${escapeMarkdown(candidate.tokenName)}`,
    `*符号：* \`${candidate.tokenSymbol}\``,
    `*描述：* ${escapeMarkdown(candidate.description.slice(0, 100))}`,
    candidate.narrative ? `*叙事：* ${escapeMarkdown(candidate.narrative.slice(0, 80))}` : null,
    ``,
    `*风险：* ${riskEmoji} ${candidate.riskLevel.toUpperCase()}${scoreStr}`,
    `*推荐链：* ${chainEmoji}`,
    `*状态：* \`${candidate.status}\``,
    `*候选ID：* \`${candidate.id}\``,
  ].filter(Boolean).join("\n");
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

function cleanExpiredPendingInputs() {
  const now = Date.now();
  for (const [key, pending] of pendingInputs.entries()) {
    if (now - pending.timestamp > INPUT_TIMEOUT_MS) {
      pendingInputs.delete(key);
    }
  }
}

export function initTelegramBot(): void {
  if (botInitialized) {
    logger.warn("Telegram 机器人已在运行，忽略重复初始化请求");
    return;
  }
  if (!TELEGRAM_BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN 未配置 — Telegram 机器人已禁用");
    return;
  }

  botInitialized = true;
  bot = new Telegraf(TELEGRAM_BOT_TOKEN);

  // 自检：deleteWebhook + getMe，确认当前连接的是哪一只 bot
  bot.telegram.deleteWebhook().then(() => {
    logger.info("✅ deleteWebhook 已执行（确保使用长轮询模式）");
  }).catch((err: unknown) => {
    logger.warn({ err: String(err) }, "⚠️  deleteWebhook 失败（不影响运行）");
  });

  bot.telegram.getMe().then((me) => {
    logger.info(
      { botId: me.id, botUsername: me.username, botName: me.first_name },
      "🤖 当前连接的 Bot：@" + me.username + "（ID: " + me.id + "）",
    );
  }).catch((err: unknown) => {
    logger.error({ err: String(err) }, "❌ getMe 失败，请检查 TELEGRAM_BOT_TOKEN 是否正确");
  });

  // 打印审批链路状态（只打一次，启动时明确告知）
  if (APPROVAL_ENABLED) {
    logger.info(
      { adminChatId: TELEGRAM_ADMIN_CHAT_ID },
      "✅ 审批消息发送功能已启用：ADMIN_CHAT_ID 合法",
    );
  } else {
    logger.warn(
      { adminChatId: TELEGRAM_ADMIN_CHAT_ID ?? "未配置" },
      "⚠️  管理员群未配置正确，审批消息发送功能当前已禁用。请在群内发送 /chatid 获取正确 ID 后重启。",
    );
  }

  bot.command("start", (ctx) => {
    ctx.reply("✅ Anti-MEV 发射机器人已就绪。候选代币将在此处等待审批。");
  });

  bot.command("status", async (ctx) => {
    const candidates = await db.select().from(candidatesTable);
    const pending = candidates.filter((c) => c.status === "pending_review").length;
    const approved = candidates.filter((c) => c.status.startsWith("approved")).length;
    ctx.reply(`📊 候选代币：共 ${candidates.length} 个 | 待审核 ${pending} 个 | 已批准 ${approved} 个`);
  });

  bot.command("chatid", (ctx) => {
    const id = ctx.chat.id;
    const type = ctx.chat.type;
    const configuredId = TELEGRAM_ADMIN_CHAT_ID ?? "未配置";
    const match = String(id) === TELEGRAM_ADMIN_CHAT_ID;
    const matchLine = match
      ? "✅ 匹配，消息可以发送到这里"
      : "❌ 不匹配！请将 TELEGRAM_ADMIN_CHAT_ID 设置为 " + id;
    // 纯文本回复，不使用 parse_mode，避免任何 Markdown/HTML 解析异常
    ctx.reply(
      "当前 Chat ID: " + id + "\n" +
      "类型: " + type + "\n" +
      "已配置 ADMIN_CHAT_ID: " + configuredId + "\n" +
      matchLine,
    );
    logger.info({ chatId: id, type, configuredId, match }, "【/chatid】命令执行");
  });

  // /testapproval — 仅用于本地验收，发送一条假候选审批消息
  bot.command("testapproval", async (ctx) => {
    logger.info({ chatId: ctx.chat.id }, "【/testapproval】收到测试审批命令");

    if (!APPROVAL_ENABLED || !TELEGRAM_ADMIN_CHAT_ID) {
      await ctx.reply(
        "❌ 审批发送功能未启用。\n" +
        "请先将 TELEGRAM_ADMIN_CHAT_ID 设置为本群的数字 ID（见 /chatid），然后重启服务。",
      );
      return;
    }

    const fakeCandidate = {
      id: 0,
      tokenName: "测试代币 TEST",
      tokenSymbol: "TEST",
      description: "这是一条用于验收测试的假候选消息，不会被真实发射。",
      narrative: "测试叙事：验收审批链路",
      riskLevel: "low" as const,
      suggestedChain: "both",
      status: "pending_review",
      bscBuyTier: "safe",
      solBuyTier: "safe",
      scoreTotal: 88,
      telegramMessageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const message = await bot!.telegram.sendMessage(
        TELEGRAM_ADMIN_CHAT_ID,
        buildCandidateMessage(fakeCandidate as unknown as Candidate),
        {
          parse_mode: "MarkdownV2",
          ...buildApprovalKeyboard(0),
        },
      );
      await ctx.reply(`✅ 测试审批消息已发送（消息 ID：${message.message_id}）。\n请验证消息格式和按钮是否正常。`);
      logger.info(
        { messageId: message.message_id, chatId: TELEGRAM_ADMIN_CHAT_ID },
        "【/testapproval】测试消息发送成功",
      );
    } catch (err) {
      const errStr = String(err);
      await ctx.reply(`❌ 发送失败：${errStr.slice(0, 200)}`);
      logger.error({ err: errStr }, "【/testapproval】测试消息发送失败");
    }
  });

  bot.on("text", async (ctx, next) => {
    cleanExpiredPendingInputs();

    const chatId = String(ctx.chat.id);
    const replyToId = ctx.message.reply_to_message?.message_id;

    if (!replyToId) {
      return next();
    }

    const pendingKey = `${chatId}:${replyToId}`;
    const pending = pendingInputs.get(pendingKey);

    if (!pending) {
      return next();
    }

    const elapsed = Date.now() - pending.timestamp;
    if (elapsed > INPUT_TIMEOUT_MS) {
      pendingInputs.delete(pendingKey);
      await ctx.reply("⏰ 输入超时（5分钟），请重新点击按钮。");
      return;
    }

    pendingInputs.delete(pendingKey);

    const rawInput = ctx.message.text.trim();
    const normalizedInput = pending.field === "tokenSymbol" ? rawInput.toUpperCase() : rawInput;

    const validationError = validateFieldInput(pending.field, normalizedInput);
    if (validationError) {
      await ctx.reply(`❌ 输入无效：${validationError}\n\n请重新点击按钮重试。`);
      return;
    }

    try {
      const [candidate] = await db
        .select()
        .from(candidatesTable)
        .where(eq(candidatesTable.id, pending.candidateId))
        .limit(1);

      if (!candidate) {
        await ctx.reply("❌ 候选不存在，可能已被删除。");
        return;
      }

      const oldValue = candidate[pending.field];
      await updateCandidateStatus(pending.candidateId, { [pending.field]: normalizedInput });

      await writeAuditLog(`candidate_${pending.field}_edited`, "candidate", pending.candidateId, "telegram_admin", {
        field: pending.field,
        oldValue,
        newValue: normalizedInput,
      });

      const updatedCandidate = { ...candidate, [pending.field]: normalizedInput };
      const fieldLabel = FIELD_LABELS[pending.field];

      await ctx.reply(
        `✅ *${fieldLabel}已更新*\n\n旧值：${escapeMarkdown(String(oldValue))}\n新值：${escapeMarkdown(normalizedInput)}`,
        { parse_mode: "MarkdownV2" },
      );

      if (TELEGRAM_ADMIN_CHAT_ID) {
        await bot!.telegram.sendMessage(
          TELEGRAM_ADMIN_CHAT_ID,
          `${buildCandidateMessage(updatedCandidate as Candidate)}\n\n✏️ *已更新 ${escapeMarkdown(fieldLabel)}*`,
          {
            parse_mode: "MarkdownV2",
            ...buildApprovalKeyboard(pending.candidateId),
          },
        );
      }

      logger.info(
        { candidateId: pending.candidateId, field: pending.field, newValue: normalizedInput },
        "Candidate field updated via Telegram",
      );
    } catch (err) {
      logger.error({ err: String(err), candidateId: pending.candidateId }, "Failed to update candidate via Telegram");
      await ctx.reply("❌ 更新失败，请稍后重试。");
    }
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
        case "resymbol":
        case "redesc": {
          const fieldMap: Record<string, PendingField> = {
            rename: "tokenName",
            resymbol: "tokenSymbol",
            redesc: "description",
          };
          const field = fieldMap[action]!;
          const prompt = FIELD_PROMPTS[field];
          const chatId = String(ctx.chat?.id ?? TELEGRAM_ADMIN_CHAT_ID);

          await ctx.answerCbQuery(`请直接回复 bot 发出的下一条消息`);

          const promptMsg = await bot!.telegram.sendMessage(
            chatId,
            prompt,
            {
              parse_mode: "MarkdownV2",
              reply_markup: { force_reply: true, selective: true },
            },
          );

          cleanExpiredPendingInputs();
          const pendingKey = `${chatId}:${promptMsg.message_id}`;
          pendingInputs.set(pendingKey, {
            candidateId,
            field,
            promptMessageId: promptMsg.message_id,
            timestamp: Date.now(),
          });

          logger.info(
            { candidateId, field, promptMessageId: promptMsg.message_id, pendingKey },
            "Telegram: waiting for field input",
          );
          break;
        }

        default:
          await ctx.answerCbQuery("Unknown action");
      }
    } catch (err) {
      logger.error({ err: String(err), action, candidateId }, "Telegram callback error");
      await ctx.answerCbQuery("Error: " + String(err).slice(0, 60));
    }
  });

  // 手动轮询——绕过 telegraf bot.launch() 的 AbortSignal 兼容性问题
  let pollingOffset = 0;
  let pollingActive = true;

  async function pollUpdates(): Promise<void> {
    while (pollingActive) {
      try {
        const updates = await bot!.telegram.getUpdates(30, 100, pollingOffset, undefined);
        for (const update of updates) {
          pollingOffset = update.update_id + 1;
          bot!.handleUpdate(update).catch((err: unknown) => {
            logger.error({ err: String(err) }, "Telegram update handler error");
          });
        }
      } catch (err) {
        if (pollingActive) {
          logger.warn({ err: String(err) }, "Telegram poll error, retrying in 3s");
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    }
  }

  pollUpdates().catch((err) => {
    logger.error({ err: String(err) }, "Telegram polling fatal error");
  });

  process.once("SIGINT", () => { pollingActive = false; bot?.stop("SIGINT"); });
  process.once("SIGTERM", () => { pollingActive = false; bot?.stop("SIGTERM"); });

  logger.info("Telegram 机器人已启动（手动长轮询）");
}

export async function sendCandidateForApproval(candidate: Candidate): Promise<boolean> {
  if (!APPROVAL_ENABLED || !bot || !TELEGRAM_ADMIN_CHAT_ID) {
    // 不打 log，由调度器统一输出一次"审批已禁用"日志，避免刷屏
    return false;
  }

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

    logger.info(
      { candidateId: candidate.id, tokenName: candidate.tokenName, chatId: TELEGRAM_ADMIN_CHAT_ID, messageId: message.message_id },
      "✅ 候选代币审批消息已发送至 Telegram",
    );
    return true;
  } catch (err) {
    const errStr = String(err);
    let hint = "";
    if (errStr.includes("chat not found")) {
      hint = "【提示】chat not found：TELEGRAM_ADMIN_CHAT_ID 配置的群/频道 ID 不正确，请向机器人发送 /chatid 获取正确 ID";
    } else if (errStr.includes("Unauthorized") || errStr.includes("401")) {
      hint = "【提示】Unauthorized：Bot Token 无效，请从 BotFather 重新获取";
    } else if (errStr.includes("bot was kicked") || errStr.includes("not a member")) {
      hint = "【提示】机器人还未加入目标群组，请先将机器人添加为群成员";
    }
    logger.error(
      { err: errStr, candidateId: candidate.id, tokenName: candidate.tokenName, chatId: TELEGRAM_ADMIN_CHAT_ID, hint: hint || undefined },
      "❌ 候选代币审批消息发送失败",
    );
    return false;
  }
}

export async function sendLaunchResult(job: LaunchJob, tokenName: string): Promise<void> {
  if (!bot || !TELEGRAM_ADMIN_CHAT_ID) return;

  const statusEmoji = job.status === "bought" ? "✅" : job.status === "failed" ? "❌" : job.status === "deployed" ? "🚀" : "ℹ️";
  const chain = job.chain.toUpperCase();
  const jobAny = job as Record<string, unknown>;

  const lines: string[] = [
    `${statusEmoji} *发射结果* — ${escapeMarkdown(tokenName)}`,
    `*链：* ${chain}`,
    `*平台：* ${escapeMarkdown(String(jobAny["platform"] ?? "unknown"))}`,
    `*模式：* ${escapeMarkdown(String(jobAny["launchMode"] ?? "unknown"))}`,
    `*状态：* \`${job.status}\``,
  ];

  if (job.contractAddress) lines.push(`*合约：* \`${job.contractAddress}\``);
  if (job.deployTxHash) lines.push(`*部署TX：* \`${job.deployTxHash.slice(0, 16)}\\.\\.\\.\``);
  if (job.buyTxHash) lines.push(`*首买TX：* \`${job.buyTxHash.slice(0, 16)}\\.\\.\\.\``);
  if (job.buyAmount) lines.push(`*首买额：* ${escapeMarkdown(job.buyAmount)}`);
  if (jobAny["opsWalletLabel"]) lines.push(`*钱包：* \`${String(jobAny["opsWalletLabel"])}\``);

  if (jobAny["deepLink"]) {
    lines.push(``, `*⬇️ 下一步操作：*`);
    lines.push(`[点击在 Pump\\.fun 创建 Token](${String(jobAny["deepLink"])})`);
  } else if (jobAny["platformUrl"]) {
    lines.push(`*平台链接：* ${escapeMarkdown(String(jobAny["platformUrl"]))}`);
  }

  if (job.errorMessage) {
    lines.push(`*错误：* ${escapeMarkdown(job.errorMessage.slice(0, 150))}`);
  }

  try {
    await bot.telegram.sendMessage(TELEGRAM_ADMIN_CHAT_ID, lines.join("\n"), {
      parse_mode: "MarkdownV2",
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    logger.error({ err: String(err) }, "Failed to send launch result to Telegram");
  }
}
