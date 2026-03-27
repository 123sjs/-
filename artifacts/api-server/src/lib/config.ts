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
