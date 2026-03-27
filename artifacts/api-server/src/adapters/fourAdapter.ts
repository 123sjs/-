import { ethers } from "ethers";
import { LaunchAdapter, type LaunchPayload, type LaunchResult, type BuyResult, BSC_BUY_AMOUNTS } from "./common";
import { getConfig } from "../lib/config";
import { getOpsWallet } from "../services/walletService";
import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const FOUR_MEME_API = process.env["FOUR_MEME_API_URL"];
const BSC_RPC_URL = process.env["BSC_RPC_URL"] ?? "https://bsc-dataseed.binance.org/";
const FOUR_MEME_PLATFORM_BASE = "https://four.meme/token/";

async function writeAudit(action: string, jobId: number, payload: Record<string, unknown>) {
  try {
    await db.insert(auditLogsTable).values({
      action,
      entityType: "launch_job",
      entityId: jobId,
      actor: "four_adapter",
      metadata: payload,
    });
  } catch (err) {
    logger.error({ err: String(err) }, "Failed to write audit log in fourAdapter");
  }
}

function getBscProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(BSC_RPC_URL, {
    chainId: 56,
    name: "bnb",
  });
}

async function estimateGas(
  provider: ethers.JsonRpcProvider,
  tx: ethers.TransactionRequest,
): Promise<{ gasLimit: bigint; gasPrice: bigint }> {
  const [gasLimit, feeData] = await Promise.all([
    provider.estimateGas(tx).catch(() => 300_000n),
    provider.getFeeData(),
  ]);
  const gasPrice = feeData.gasPrice ?? ethers.parseUnits("5", "gwei");
  return { gasLimit: (gasLimit * 130n) / 100n, gasPrice };
}

export class FourAdapter extends LaunchAdapter {
  validate(payload: LaunchPayload): { ok: boolean; errors: string[] } {
    const cfg = getConfig();
    const errors: string[] = [];

    if (!cfg.enableBscLaunch) {
      return { ok: false, errors: ["BSC launch is disabled (ENABLE_BSC_LAUNCH=false)"] };
    }
    if (!payload.tokenName || payload.tokenName.length < 2 || payload.tokenName.length > 20) {
      errors.push("tokenName must be 2–20 chars");
    }
    if (!payload.tokenSymbol || !/^[A-Z]{2,8}$/.test(payload.tokenSymbol)) {
      errors.push("tokenSymbol must be 2–8 uppercase letters");
    }
    if (!payload.description || payload.description.length < 10) {
      errors.push("description must be at least 10 chars");
    }
    if (!BSC_RPC_URL) {
      errors.push("BSC_RPC_URL not configured");
    }

    return { ok: errors.length === 0, errors };
  }

  async launch(payload: LaunchPayload): Promise<LaunchResult> {
    const cfg = getConfig();

    if (!cfg.enableBscLaunch) {
      return {
        ok: false,
        platform: "four_meme",
        launchMode: "stub",
        errorMessage: "BSC launch disabled",
      };
    }

    logger.info({ candidateId: payload.candidateId, tokenName: payload.tokenName }, "FourAdapter.launch");

    if (FOUR_MEME_API) {
      return this._launchViaApi(payload);
    }

    logger.warn({ jobId: payload.jobId }, "[STUB] FOUR_MEME_API_URL not set — returning stub launch result");
    const stubAddr = `0x${"f0".repeat(18)}${payload.jobId.toString().padStart(4, "0")}`;
    const stubTx = `0x${"ab".repeat(31)}${payload.jobId.toString().padStart(2, "0")}`;

    await writeAudit("launch_stub", payload.jobId, {
      reason: "FOUR_MEME_API_URL not configured",
      tokenName: payload.tokenName,
      contractAddress: stubAddr,
    });

    return {
      ok: true,
      platform: "four_meme",
      launchMode: "stub",
      contractAddress: stubAddr,
      deployTxHash: stubTx,
      platformUrl: `${FOUR_MEME_PLATFORM_BASE}${stubAddr}`,
      instructions: "STUB MODE — configure FOUR_MEME_API_URL to enable real deployment",
      raw: { stub: true },
    };
  }

  private async _launchViaApi(payload: LaunchPayload): Promise<LaunchResult> {
    try {
      const body = {
        name: payload.tokenName,
        symbol: payload.tokenSymbol,
        description: payload.description,
        logo: payload.logoUrl,
        chain: "bsc",
      };

      const resp = await fetch(`${FOUR_MEME_API}/v1/launch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env["FOUR_API_KEY"] ? { Authorization: `Bearer ${process.env["FOUR_API_KEY"]}` } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        const msg = `four.meme API error ${resp.status}: ${errText.slice(0, 200)}`;
        await writeAudit("launch_api_error", payload.jobId, { status: resp.status, body: errText.slice(0, 200) });
        return { ok: false, platform: "four_meme", launchMode: "real", errorMessage: msg };
      }

      const data = await resp.json() as Record<string, unknown>;
      const contractAddress = String(data["contractAddress"] ?? data["tokenAddress"] ?? "");
      const deployTxHash = String(data["txHash"] ?? data["deployTxHash"] ?? "");

      await writeAudit("launch_api_success", payload.jobId, { contractAddress, deployTxHash });

      return {
        ok: true,
        platform: "four_meme",
        launchMode: "real",
        contractAddress,
        deployTxHash,
        platformUrl: `${FOUR_MEME_PLATFORM_BASE}${contractAddress}`,
        raw: data,
      };
    } catch (err) {
      const msg = String(err);
      await writeAudit("launch_api_exception", payload.jobId, { error: msg });
      return { ok: false, platform: "four_meme", launchMode: "real", errorMessage: msg };
    }
  }

  async opsBuy(payload: LaunchPayload): Promise<BuyResult> {
    const cfg = getConfig();

    if (!cfg.enableOpsBuy) {
      logger.warn({ candidateId: payload.candidateId }, "Ops buy skipped: ENABLE_OPS_BUY=false");
      return { ok: false, errorMessage: "Ops buy is disabled", isStub: false };
    }

    const opsWallet = await getOpsWallet("bsc");
    if (!opsWallet) {
      logger.warn("BSC ops wallet not configured — ops buy skipped");
      return { ok: false, errorMessage: "BSC ops wallet not configured", isStub: false };
    }

    const tier = payload.buyTier ?? "safe";
    const amountBnb = BSC_BUY_AMOUNTS[tier] ?? BSC_BUY_AMOUNTS["safe"]!;
    const amountWei = ethers.parseEther(amountBnb);

    if (!opsWallet.privKey) {
      logger.warn({ wallet: opsWallet.address }, "BSC ops wallet address known but no private key — stub buy");
      return { ok: false, errorMessage: "BSC ops wallet private key not configured", isStub: true, walletLabel: "bsc_ops_buy" };
    }

    try {
      const provider = getBscProvider();
      const signer = new ethers.Wallet(opsWallet.privKey, provider);

      const contractAddress = payload.contractAddress;
      if (!contractAddress || !contractAddress.startsWith("0x")) {
        logger.warn({ jobId: payload.jobId }, "No valid contract address for opsBuy — using stub");
        await writeAudit("ops_buy_stub", payload.jobId, {
          reason: "no contract address",
          wallet: opsWallet.address,
          amount: amountBnb,
        });
        return {
          ok: true,
          isStub: true,
          txHash: `0x${"0b".repeat(31)}${payload.jobId.toString().padStart(2, "0")}`,
          amountSpent: `${amountBnb} BNB (stub — no contract)`,
          walletLabel: "bsc_ops_buy",
        };
      }

      const tx: ethers.TransactionRequest = {
        to: contractAddress,
        value: amountWei,
        chainId: 56,
      };

      const { gasLimit, gasPrice } = await estimateGas(provider, tx);
      tx.gasLimit = gasLimit;
      tx.gasPrice = gasPrice;

      logger.info(
        { from: signer.address, to: contractAddress, amount: `${amountBnb} BNB`, gasLimit: gasLimit.toString() },
        "FourAdapter.opsBuy — sending real BNB transfer",
      );

      const sent = await signer.sendTransaction(tx);
      const receipt = await sent.wait(1);

      if (!receipt || receipt.status === 0) {
        const msg = "BSC ops buy transaction reverted";
        await writeAudit("ops_buy_reverted", payload.jobId, { txHash: sent.hash, amount: amountBnb });
        return { ok: false, txHash: sent.hash, errorMessage: msg, walletLabel: "bsc_ops_buy" };
      }

      await writeAudit("ops_buy_success", payload.jobId, {
        txHash: receipt.hash,
        amount: `${amountBnb} BNB`,
        wallet: signer.address,
        blockNumber: receipt.blockNumber,
      });

      return {
        ok: true,
        txHash: receipt.hash,
        amountSpent: `${amountBnb} BNB`,
        walletLabel: "bsc_ops_buy",
        isStub: false,
      };
    } catch (err) {
      const msg = String(err).replace(/privKey|private.*key|0x[0-9a-fA-F]{10,}/gi, "[REDACTED]");
      logger.error({ jobId: payload.jobId, err: msg }, "FourAdapter.opsBuy error");
      await writeAudit("ops_buy_error", payload.jobId, { error: msg });
      return { ok: false, errorMessage: msg, walletLabel: "bsc_ops_buy" };
    }
  }

  async getStatus(jobId: number): Promise<{ status: string; details: Record<string, unknown> }> {
    return {
      status: "unknown",
      details: { jobId, adapter: "four_meme", rpc: BSC_RPC_URL, apiConfigured: Boolean(FOUR_MEME_API) },
    };
  }
}

export const fourAdapter = new FourAdapter();
