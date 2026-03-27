import { LaunchAdapter, type LaunchPayload, type LaunchResult, type BuyResult, SOL_BUY_AMOUNTS } from "./common";
import { getConfig } from "../lib/config";
import { getOpsWallet } from "../services/walletService";
import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const PUMP_FUN_BASE = "https://pump.fun";
const PUMP_FUN_CREATE_URL = `${PUMP_FUN_BASE}/create`;

async function writeAudit(action: string, jobId: number, metadata: Record<string, unknown>) {
  try {
    await db.insert(auditLogsTable).values({
      action,
      entityType: "launch_job",
      entityId: jobId,
      actor: "pump_adapter",
      metadata,
    });
  } catch (err) {
    logger.error({ err: String(err) }, "Failed to write audit log in pumpAdapter");
  }
}

function buildPumpDeepLink(payload: LaunchPayload): string {
  const params = new URLSearchParams({
    name: payload.tokenName,
    symbol: payload.tokenSymbol,
    description: payload.description.slice(0, 200),
  });
  return `${PUMP_FUN_CREATE_URL}?${params.toString()}`;
}

function buildManualInstructions(payload: LaunchPayload, deepLink: string): string {
  return [
    `=== PUMP.FUN 手动发射指南 / Manual Launch Guide ===`,
    ``,
    `Token Name  : ${payload.tokenName}`,
    `Symbol      : ${payload.tokenSymbol}`,
    `Description : ${payload.description.slice(0, 120)}`,
    payload.logoUrl ? `Logo URL    : ${payload.logoUrl}` : `Logo        : (需手动上传 / upload manually)`,
    ``,
    `步骤 / Steps:`,
    `1. 打开链接 / Open: ${deepLink}`,
    `2. 连接 Solana 钱包 (deployer)`,
    `3. 填入上方字段，上传 logo`,
    `4. 点击 "Create Token" 并签名`,
    `5. 记录合约地址 / Record contract address`,
    `6. 在后台 admin 更新 launch_job.contractAddress`,
    `7. 运营钱包 ops_buy 执行首买 (配置后自动执行)`,
  ].join("\n");
}

export class PumpAdapter extends LaunchAdapter {
  validate(payload: LaunchPayload): { ok: boolean; errors: string[] } {
    const cfg = getConfig();
    const errors: string[] = [];

    if (!cfg.enableSolLaunch) {
      return { ok: false, errors: ["SOL launch is disabled (ENABLE_SOL_LAUNCH=false)"] };
    }
    if (!payload.tokenName || payload.tokenName.length < 2 || payload.tokenName.length > 32) {
      errors.push("tokenName must be 2–32 chars");
    }
    if (!payload.tokenSymbol || payload.tokenSymbol.length < 2 || payload.tokenSymbol.length > 10) {
      errors.push("tokenSymbol must be 2–10 chars");
    }
    if (!payload.description || payload.description.length < 10) {
      errors.push("description must be at least 10 chars");
    }

    return { ok: errors.length === 0, errors };
  }

  async launch(payload: LaunchPayload): Promise<LaunchResult> {
    const cfg = getConfig();

    if (!cfg.enableSolLaunch) {
      return {
        ok: false,
        platform: "pump_fun",
        launchMode: "manual_final",
        errorMessage: "SOL launch disabled",
      };
    }

    logger.info({ candidateId: payload.candidateId, tokenName: payload.tokenName }, "PumpAdapter.launch (semi-auto)");

    const deepLink = buildPumpDeepLink(payload);
    const instructions = buildManualInstructions(payload, deepLink);

    const candidateSummary = {
      name: payload.tokenName,
      symbol: payload.tokenSymbol,
      description: payload.description.slice(0, 200),
      logoUrl: payload.logoUrl,
    };

    await writeAudit("launch_manual_initiated", payload.jobId, {
      platform: "pump_fun",
      deepLink,
      candidateSummary,
    });

    logger.info({ jobId: payload.jobId, deepLink }, "PumpAdapter: manual launch package ready");

    return {
      ok: true,
      platform: "pump_fun",
      launchMode: "manual_final",
      platformUrl: PUMP_FUN_BASE,
      deepLink,
      instructions,
      contractAddress: undefined,
      deployTxHash: undefined,
      raw: { candidateSummary },
    };
  }

  async opsBuy(payload: LaunchPayload): Promise<BuyResult> {
    const cfg = getConfig();

    if (!cfg.enableOpsBuy) {
      return { ok: false, errorMessage: "Ops buy is disabled", isStub: false };
    }

    const opsWallet = await getOpsWallet("sol");
    const tier = payload.buyTier ?? "safe";
    const amountSol = SOL_BUY_AMOUNTS[tier] ?? SOL_BUY_AMOUNTS["safe"]!;

    if (!opsWallet) {
      logger.warn({ jobId: payload.jobId }, "SOL ops wallet not configured");
      await writeAudit("ops_buy_not_configured", payload.jobId, {
        tier,
        amount: `${amountSol} SOL`,
        note: "Configure SOL_OPS_BUY_ADDRESS to enable",
      });
      return {
        ok: false,
        isStub: true,
        errorMessage: "SOL ops wallet not configured. Set SOL_OPS_BUY_ADDRESS and add wallet to DB.",
        walletLabel: "sol_ops_buy",
      };
    }

    if (!opsWallet.privKey) {
      await writeAudit("ops_buy_no_privkey", payload.jobId, {
        wallet: opsWallet.address,
        tier,
        amount: `${amountSol} SOL`,
        note: "Private key not configured — P2 task: add @solana/web3.js signing",
      });
      return {
        ok: false,
        isStub: true,
        errorMessage: `SOL ops wallet found (${opsWallet.address}) but private key not configured. P2 task pending: @solana/web3.js signing.`,
        walletLabel: "sol_ops_buy",
      };
    }

    logger.warn({ jobId: payload.jobId, wallet: opsWallet.address }, "SOL ops buy: @solana/web3.js not yet integrated (P2 task)");
    await writeAudit("ops_buy_pending_p2", payload.jobId, {
      wallet: opsWallet.address,
      tier,
      amount: `${amountSol} SOL`,
      note: "@solana/web3.js signing integration pending (P2)",
    });
    return {
      ok: false,
      isStub: true,
      errorMessage: `SOL signing not yet implemented (P2). Wallet: ${opsWallet.address}, Amount: ${amountSol} SOL`,
      walletLabel: "sol_ops_buy",
    };
  }

  async getStatus(jobId: number): Promise<{ status: string; details: Record<string, unknown> }> {
    return {
      status: "manual_pending",
      details: {
        jobId,
        adapter: "pump_fun",
        note: "Semi-auto: launch requires manual step on pump.fun. Check launch_jobs.platform_url for deeplink.",
        nextStep: "Open deepLink from launch result, create token on pump.fun, then update contractAddress via admin API",
      },
    };
  }
}

export const pumpAdapter = new PumpAdapter();
