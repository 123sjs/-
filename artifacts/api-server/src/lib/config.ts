import { logger } from "./logger";

export interface AppConfig {
  appEnv: string;
  enableSolLaunch: boolean;
  enableBscLaunch: boolean;
  enableOpsBuy: boolean;
  enableLegacyTrading: boolean;
  trendIntervalMinutes: number;
  telegramBotToken: string | undefined;
  telegramAdminChatId: string | undefined;
  databaseUrl: string;
}

/** 打印敏感字段摘要：只显示长度和前6位，不泄露完整内容 */
function redact(val: string): string {
  return `${val.slice(0, 6)}... (长度 ${val.length})`;
}

/**
 * 启动强校验：检查运行所必需的环境变量。
 * 缺失或格式不合法时打印中文错误并退出。
 * 在 app.listen 之前调用。
 */
export function validateStartupEnv(): void {
  const errors: string[] = [];

  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    errors.push("❌ TELEGRAM_BOT_TOKEN 未配置（必须设置才能启动 Telegram 机器人）");
  } else if (token.length < 20) {
    errors.push(`❌ TELEGRAM_BOT_TOKEN 格式异常：${redact(token)}（长度过短，请检查是否完整）`);
  } else {
    logger.info({ summary: redact(token) }, "✅ TELEGRAM_BOT_TOKEN 已读取");
  }

  const chatId = process.env["TELEGRAM_ADMIN_CHAT_ID"];
  if (!chatId) {
    // 未配置：不退出，但审批功能禁用
    logger.warn(
      "⚠️  TELEGRAM_ADMIN_CHAT_ID 未配置。" +
      "管理员群未配置正确，审批消息发送功能当前已禁用。" +
      "请先将机器人拉进管理员群，再通过 /chatid 获取正确群组 ID 并填入 Replit Secrets。",
    );
  } else if (!/^-?\d+$/.test(chatId.trim())) {
    // 格式错误：不退出，但审批功能禁用；服务可启动以便 /chatid 命令可用
    logger.warn(
      `⚠️  TELEGRAM_ADMIN_CHAT_ID 格式不合法：当前值="${chatId}"。` +
      `管理员群未配置正确，审批消息发送功能当前已禁用。` +
      `应为纯数字，群组 ID 通常为负数，如 -1001234567890。` +
      `请在管理员群发送 /chatid，复制机器人回复的负数 ID，填入 Replit Secrets 后重启。`,
    );
  } else {
    logger.info({ chatId }, "✅ TELEGRAM_ADMIN_CHAT_ID 已读取");
  }

  const dbUrl = process.env["DATABASE_URL"];
  if (!dbUrl) {
    errors.push("❌ DATABASE_URL 未配置（数据库连接必须设置）");
  } else {
    logger.info("✅ DATABASE_URL 已读取");
  }

  if (errors.length > 0) {
    for (const msg of errors) {
      logger.error(msg);
    }
    logger.error(`启动失败：共 ${errors.length} 个必需配置缺失或不合法，请检查环境变量后重启。`);
    process.exit(1);
  }
}

function bool(val: string | undefined, fallback: boolean): boolean {
  if (val === undefined) return fallback;
  return val.toLowerCase() === "true" || val === "1";
}

function int(val: string | undefined, fallback: number): number {
  if (val === undefined) return fallback;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? fallback : n;
}

function loadConfig(): AppConfig {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required but not set");
  }

  const cfg: AppConfig = {
    appEnv: process.env["APP_ENV"] ?? "development",
    enableSolLaunch: bool(process.env["ENABLE_SOL_LAUNCH"], true),
    enableBscLaunch: bool(process.env["ENABLE_BSC_LAUNCH"], true),
    enableOpsBuy: bool(process.env["ENABLE_OPS_BUY"], true),
    enableLegacyTrading: bool(process.env["ENABLE_LEGACY_TRADING"], false),
    trendIntervalMinutes: int(process.env["TREND_INTERVAL_MINUTES"], 10),
    telegramBotToken: process.env["TELEGRAM_BOT_TOKEN"],
    telegramAdminChatId: process.env["TELEGRAM_ADMIN_CHAT_ID"],
    databaseUrl,
  };

  if (cfg.enableLegacyTrading) {
    logger.warn("ENABLE_LEGACY_TRADING=true — legacy multi-wallet trading is active. This is NOT recommended in production.");
  }

  logger.info({
    appEnv: cfg.appEnv,
    enableSolLaunch: cfg.enableSolLaunch,
    enableBscLaunch: cfg.enableBscLaunch,
    enableOpsBuy: cfg.enableOpsBuy,
    enableLegacyTrading: cfg.enableLegacyTrading,
    trendIntervalMinutes: cfg.trendIntervalMinutes,
    telegramEnabled: Boolean(cfg.telegramBotToken && cfg.telegramAdminChatId),
  }, "App config loaded");

  return cfg;
}

let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}
