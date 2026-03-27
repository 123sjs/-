import {
  Connection,
  Keypair,
  VersionedTransaction,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import bs58 from "bs58";
import { LaunchAdapter, type LaunchPayload, type LaunchResult, type BuyResult, SOL_BUY_AMOUNTS } from "./common";
import { getConfig } from "../lib/config";
import { getOpsWallet } from "../services/walletService";
import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const PUMP_FUN_BASE = "https://pump.fun";
const PUMP_FUN_CREATE_URL = `${PUMP_FUN_BASE}/create`;
const PUMP_PORTAL_TRADE_URL = "https://pumpportal.fun/api/trade-local";
const SOL_RPC = process.env["SOLANA_RPC_URL"] ?? "https://api.mainnet-beta.solana.com";

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
    `7. 运营钱包 ops_buy 将自动执行首买`,
  ].join("\n");
}

function loadKeypair(privKey: string): Keypair {
  let raw: Uint8Array;
  const trimmed = privKey.trim();

  if (trimmed.startsWith("[")) {
    const arr = JSON.parse(trimmed) as number[];
    raw = Uint8Array.from(arr);
  } else {
    raw = bs58.decode(trimmed);
  }

  if (raw.length === 64) {
    return Keypair.fromSecretKey(raw);
  }
  if (raw.length === 32) {
    return Keypair.fromSeed(raw);
  }
  throw new Error(`Unexpected key length: ${raw.length}`);
}

async function executePumpBuy(
  keypair: Keypair,
  mint: string,
  amountSol: number,
): Promise<{ txHash: string; amountSpent: string }> {
  const tradeResp = await fetch(PUMP_PORTAL_TRADE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: keypair.publicKey.toBase58(),
      action: "buy",
      mint,
      denominatedInSol: "true",
      amount: amountSol,
      slippage: 15,
      priorityFee: 0.0005,
      pool: "pump",
    }),
  });

  if (!tradeResp.ok) {
    const body = await tradeResp.text().catch(() => "");
    throw new Error(`PumpPortal trade-local error ${tradeResp.status}: ${body.slice(0, 200)}`);
  }

  const rawTx = await tradeResp.arrayBuffer();
  const tx = VersionedTransaction.deserialize(new Uint8Array(rawTx));
  tx.sign([keypair]);

  const connection = new Connection(SOL_RPC, "confirmed");
  const sig = await connection.sendTransaction(tx, {
    skipPreflight: false,
    maxRetries: 3,
  });

  await connection.confirmTransaction(sig, "confirmed");

  return {
    txHash: sig,
    amountSpent: `${amountSol} SOL`,
  };
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
    const amountSol = parseFloat(SOL_BUY_AMOUNTS[tier] ?? SOL_BUY_AMOUNTS["safe"]!);

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

    const mint = payload.contractAddress;
    if (!mint) {
      await writeAudit("ops_buy_awaiting_mint", payload.jobId, {
        wallet: opsWallet.address,
        tier,
        amount: `${amountSol} SOL`,
        note: "contractAddress not yet set — waiting for manual launch step",
      });
      return {
        ok: false,
        isStub: false,
        errorMessage: "Token mint address not set yet. Complete manual pump.fun launch, then call PATCH /admin/launch-jobs/:id/contract to set contractAddress.",
        walletLabel: "sol_ops_buy",
      };
    }

    if (!opsWallet.privKey) {
      await writeAudit("ops_buy_no_privkey", payload.jobId, {
        wallet: opsWallet.address,
        tier,
        amount: `${amountSol} SOL`,
        note: "Private key not set for sol_ops_buy wallet",
      });
      return {
        ok: false,
        isStub: false,
        errorMessage: `SOL ops wallet ${opsWallet.address} found but private key not stored. Add encrypted_priv_key to wallets table.`,
        walletLabel: "sol_ops_buy",
      };
    }

    try {
      new PublicKey(mint);
    } catch {
      return {
        ok: false,
        isStub: false,
        errorMessage: `Invalid Solana token mint address: ${mint}`,
        walletLabel: "sol_ops_buy",
      };
    }

    logger.info({ jobId: payload.jobId, mint, amountSol, tier }, "PumpAdapter.opsBuy: executing SOL buy");

    let keypair: Keypair;
    try {
      keypair = loadKeypair(opsWallet.privKey);
    } catch (err) {
      return {
        ok: false,
        isStub: false,
        errorMessage: `Failed to load SOL keypair: ${String(err)}`,
        walletLabel: "sol_ops_buy",
      };
    }

    const connection = new Connection(SOL_RPC, "confirmed");
    const balanceLamports = await connection.getBalance(keypair.publicKey);
    const balanceSol = balanceLamports / LAMPORTS_PER_SOL;
    const needed = amountSol + 0.002;

    if (balanceSol < needed) {
      const msg = `Insufficient SOL balance. Have ${balanceSol.toFixed(4)} SOL, need ${needed.toFixed(4)} SOL (buy ${amountSol} + ~0.002 fees).`;
      logger.warn({ jobId: payload.jobId, balanceSol, needed }, msg);
      await writeAudit("ops_buy_insufficient_balance", payload.jobId, {
        wallet: keypair.publicKey.toBase58(),
        balanceSol,
        needed,
        mint,
        tier,
      });
      return {
        ok: false,
        isStub: false,
        errorMessage: msg,
        walletLabel: "sol_ops_buy",
      };
    }

    try {
      const { txHash, amountSpent } = await executePumpBuy(keypair, mint, amountSol);

      logger.info({ jobId: payload.jobId, txHash, mint, amountSpent }, "PumpAdapter.opsBuy: success");
      await writeAudit("ops_buy_success", payload.jobId, {
        wallet: keypair.publicKey.toBase58(),
        mint,
        txHash,
        amountSpent,
        tier,
        rpc: SOL_RPC,
      });

      return {
        ok: true,
        txHash,
        amountSpent,
        isStub: false,
        walletLabel: "sol_ops_buy",
      };
    } catch (err) {
      const msg = String(err);
      logger.error({ jobId: payload.jobId, err: msg, mint }, "PumpAdapter.opsBuy: transaction failed");
      await writeAudit("ops_buy_failed", payload.jobId, {
        wallet: keypair.publicKey.toBase58(),
        mint,
        error: msg,
        tier,
        amountSol,
      });
      return {
        ok: false,
        isStub: false,
        errorMessage: `SOL buy transaction failed: ${msg}`,
        walletLabel: "sol_ops_buy",
      };
    }
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
