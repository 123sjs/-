import { LaunchAdapter, type LaunchPayload, type LaunchResult, type BuyResult, SOL_BUY_AMOUNTS } from "./common";
import { logger } from "../lib/logger";

const SOL_OPS_WALLET = process.env["SOL_OPS_BUY_ADDRESS"];

export class PumpAdapter extends LaunchAdapter {
  validate(payload: LaunchPayload): { ok: boolean; errors: string[] } {
    const errors: string[] = [];

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
    if (!SOL_OPS_WALLET) {
      logger.warn("SOL_OPS_BUY_ADDRESS not set — ops buy skipped");
      return { ok: false, errorMessage: "SOL ops buy wallet not configured" };
    }

    const tier = payload.buyTier ?? "safe";
    const amount = SOL_BUY_AMOUNTS[tier] ?? SOL_BUY_AMOUNTS["safe"]!;

    logger.info({ candidateId: payload.candidateId, tier, amount, wallet: SOL_OPS_WALLET }, "PumpAdapter.opsBuy — stub");

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
