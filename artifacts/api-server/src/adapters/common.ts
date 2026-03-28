export interface LaunchPayload {
  candidateId: number;
  jobId: number;
  tokenName: string;
  tokenSymbol: string;
  description: string;
  logoUrl: string | null;
  contractAddress?: string | null;
  buyTier?: string | null;
  chain: "bsc" | "sol";
}

export interface LaunchResult {
  ok: boolean;
  platform: string;
  platformUrl?: string;
  contractAddress?: string;
  deployTxHash?: string;
  launchMode: "real" | "stub" | "manual_final";
  instructions?: string;
  deepLink?: string;
  errorMessage?: string;
  raw?: Record<string, unknown>;
}

export interface BuyResult {
  ok: boolean;
  txHash?: string;
  amountSpent?: string;
  walletLabel?: string;
  isStub?: boolean;
  isAwaitingMint?: boolean;
  errorMessage?: string;
}

export const BSC_BUY_AMOUNTS: Record<string, string> = {
  safe: "0.10",
  normal: "0.30",
  aggressive: "0.50",
};

export const SOL_BUY_AMOUNTS: Record<string, string> = {
  safe: "0.05",
  normal: "0.10",
  aggressive: "0.20",
};

export abstract class LaunchAdapter {
  abstract validate(payload: LaunchPayload): { ok: boolean; errors: string[] };
  abstract launch(payload: LaunchPayload): Promise<LaunchResult>;
  abstract opsBuy(payload: LaunchPayload): Promise<BuyResult>;
  abstract getStatus(jobId: number): Promise<{ status: string; details: Record<string, unknown> }>;
}
