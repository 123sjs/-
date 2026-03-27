import { LaunchAdapter, type LaunchPayload, type LaunchResult, type BuyResult, BSC_BUY_AMOUNTS } from "./common";
import { logger } from "../lib/logger";

const FOUR_MEME_API = process.env["FOUR_MEME_API_URL"] ?? "https://api.four.meme";
const BSC_OPS_WALLET = process.env["BSC_OPS_BUY_ADDRESS"];
const BSC_OPS_PRIVKEY = process.env["BSC_OPS_BUY_PRIVKEY"];

export class FourAdapter extends LaunchAdapter {
  validate(payload: LaunchPayload): { ok: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!payload.tokenName || payload.tokenName.length < 2 || payload.tokenName.length > 20) {
      errors.push("tokenName must be 2-20 chars");
    }
    if (!payload.tokenSymbol || payload.tokenSymbol.length < 2 || payload.tokenSymbol.length > 8) {
      errors.push("tokenSymbol must be 2-8 chars");
    }
    if (!payload.description || payload.description.length < 10) {
      errors.push("description must be at least 10 chars");
    }

    return { ok: errors.length === 0, errors };
  }

  async launch(payload: LaunchPayload): Promise<LaunchResult> {
    logger.info({ payload: { candidateId: payload.candidateId, tokenName: payload.tokenName } }, "FourAdapter.launch called");

    if (!process.env["FOUR_MEME_API_URL"]) {
      logger.warn("FOUR_MEME_API_URL not set — using stub response");
      return {
        ok: true,
        contractAddress: `0x${"stub".repeat(10)}${payload.jobId.toString().padStart(4, "0")}`,
        deployTxHash: `0x${"deploytx".repeat(8)}`,
      };
    }

    try {
      const body = {
        name: payload.tokenName,
        symbol: payload.tokenSymbol,
        description: payload.description,
        logoUrl: payload.logoUrl,
        chain: "bsc",
      };

      const resp = await fetch(`${FOUR_MEME_API}/v1/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return { ok: false, errorMessage: `four.meme API error ${resp.status}: ${errText.slice(0, 200)}` };
      }

      const data = await resp.json() as Record<string, unknown>;
      return {
        ok: true,
        contractAddress: String(data["contractAddress"] ?? ""),
        deployTxHash: String(data["txHash"] ?? ""),
      };
    } catch (err) {
      return { ok: false, errorMessage: String(err) };
    }
  }

  async opsBuy(payload: LaunchPayload): Promise<BuyResult> {
    if (!BSC_OPS_WALLET || !BSC_OPS_PRIVKEY) {
      logger.warn("BSC_OPS_BUY_ADDRESS or BSC_OPS_BUY_PRIVKEY not set — ops buy skipped");
      return { ok: false, errorMessage: "BSC ops buy wallet not configured" };
    }

    const tier = payload.buyTier ?? "safe";
    const amount = BSC_BUY_AMOUNTS[tier] ?? BSC_BUY_AMOUNTS["safe"]!;

    logger.info({ candidateId: payload.candidateId, tier, amount }, "FourAdapter.opsBuy — stub");

    return {
      ok: true,
      txHash: `0x${"buytx".repeat(12)}${payload.jobId}`,
      amountSpent: `${amount} BNB`,
    };
  }

  async getStatus(jobId: number): Promise<{ status: string; details: Record<string, unknown> }> {
    return { status: "pending", details: { jobId, adapter: "four_meme", note: "stub" } };
  }
}

export const fourAdapter = new FourAdapter();
