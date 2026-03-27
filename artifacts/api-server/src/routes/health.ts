import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getConfig } from "../lib/config";
import { isTelegramEnabled } from "../services/telegramBot";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  const cfg = getConfig();

  let dbStatus = "ok";
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    dbStatus = "error";
  }

  res.json({
    status: dbStatus === "ok" ? "ok" : "degraded",
    version: process.env["npm_package_version"] ?? "unknown",
    appEnv: cfg.appEnv,
    database: dbStatus,
    telegram: isTelegramEnabled() ? "connected" : "disabled",
    features: {
      bscLaunch: cfg.enableBscLaunch,
      solLaunch: cfg.enableSolLaunch,
      opsBuy: cfg.enableOpsBuy,
      legacyTrading: cfg.enableLegacyTrading,
    },
    uptime: Math.floor(process.uptime()),
  });
});

export default router;
