export interface LaunchPayload {
  candidateId: number;
  jobId: number;
  tokenName: string;
  tokenSymbol: string;
  description: string;
  logoUrl: string | null;
  buyTier?: string | null;
  chain: "bsc" | "sol";
}

export interface LaunchResult {
  ok: boolean;
  contractAddress?: string;
  deployTxHash?: string;
  errorMessage?: string;
}

export interface BuyResult {
  ok: boolean;
  txHash?: string;
  amountSpent?: string;
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
