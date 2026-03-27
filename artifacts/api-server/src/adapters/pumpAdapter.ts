import { LaunchAdapter, type LaunchPayload, type LaunchResult, type BuyResult, SOL_BUY_AMOUNTS } from "./common";
import { getConfig } from "../lib/config";
import { getOpsWallet } from "../services/walletService";
import { logger } from "../lib/logger";

export class PumpAdapter extends LaunchAdapter {
  validate(payload: LaunchPayload): { ok: boolean; errors: string[] } {
    const cfg = getConfig();
    const errors: string[] = [];

    if (!cfg.enableSolLaunch) {
      errors.push("SOL launch is disabled (ENABLE_SOL_LAUNCH=false)");
      return { ok: false, errors };
    }

    if (!payload.tokenName || payload.tokenName.length < 2 || payload.tokenName.length > 32) {
      errors.push("tokenName must be 2-32 chars");
    }
    if (!payload.tokenSymbol || payload.tokenSymbol.length < 2 || payload.tokenSymbol.length > 10) {
      errors.push("tokenSymbol must be 2-10 chars");
    }
    if (!payload.description || payload.description.length < 10) {
      errors.push("description must be at least 10 chars");
    }

    return { ok: errors.length === 0, errors };
  }

  async launch(payload: LaunchPayload): Promise<LaunchResult> {
    const cfg = getConfig();

    if (!cfg.enableSolLaunch) {
      logger.warn({ candidateId: payload.candidateId }, "SOL launch skipped: ENABLE_SOL_LAUNCH=false");
      return { ok: false, errorMessage: "SOL launch is disabled" };
    }

    logger.info({ payload: { candidateId: payload.candidateId, tokenName: payload.tokenName } }, "PumpAdapter.launch called (semi-auto)");

    logger.info(
      {
        name: payload.tokenName,
        symbol: payload.tokenSymbol,
        description: payload.description,
        logoUrl: payload.logoUrl,
      },
      "Pump.fun semi-auto launch — manual step required on pump.fun",
    );

    return {
      ok: true,
      contractAddress: `stub_pump_${payload.jobId}_${Date.now()}`,
      deployTxHash: `stub_pump_tx_${payload.jobId}`,
    };
  }

  async opsBuy(payload: LaunchPayload): Promise<BuyResult> {
    const cfg = getConfig();

    if (!cfg.enableOpsBuy) {
      logger.warn({ candidateId: payload.candidateId }, "Ops buy skipped: ENABLE_OPS_BUY=false");
      return { ok: false, errorMessage: "Ops buy is disabled" };
    }

    const opsWallet = await getOpsWallet("sol");
    if (!opsWallet) {
      logger.warn("SOL ops wallet not configured — ops buy skipped");
      return { ok: false, errorMessage: "SOL ops wallet not configured" };
    }

    const tier = payload.buyTier ?? "safe";
    const amount = SOL_BUY_AMOUNTS[tier] ?? SOL_BUY_AMOUNTS["safe"]!;

    logger.info(
      { candidateId: payload.candidateId, tier, amount, wallet: opsWallet.address },
      "PumpAdapter.opsBuy — single ops wallet first-buy (stub)",
    );

    return {
      ok: true,
      txHash: `stub_sol_buy_tx_${payload.jobId}_${Date.now()}`,
      amountSpent: `${amount} SOL`,
    };
  }

  async getStatus(jobId: number): Promise<{ status: string; details: Record<string, unknown> }> {
    return { status: "pending", details: { jobId, adapter: "pump_fun", note: "semi-auto — check pump.fun dashboard" } };
  }
}

export const pumpAdapter = new PumpAdapter();
