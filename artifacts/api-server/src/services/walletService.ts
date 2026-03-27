import * as crypto from "crypto";
import { db } from "@workspace/db";
import { walletsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

const ENCRYPT_KEY_ENV = "WALLET_ENCRYPT_KEY";

function getEncryptionKey(): Buffer {
  const raw = process.env[ENCRYPT_KEY_ENV];
  if (!raw) {
    logger.warn(`${ENCRYPT_KEY_ENV} not set — using insecure dev key. Set a 32-byte hex secret in production.`);
    return Buffer.from("devdevdevdevdevdevdevdevdevdevdev");
  }
  const buf = Buffer.from(raw, "hex");
  if (buf.length !== 32) {
    throw new Error(`${ENCRYPT_KEY_ENV} must be exactly 32 bytes (64 hex chars). Got ${buf.length} bytes.`);
  }
  return buf;
}

export function encryptPrivKey(privKey: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(privKey, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptPrivKey(encrypted: string): string {
  const key = getEncryptionKey();
  const [ivHex, dataHex] = encrypted.split(":");
  if (!ivHex || !dataHex) throw new Error("Invalid encrypted private key format");
  const iv = Buffer.from(ivHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

export type WalletRole = "deployer" | "treasury" | "ops_buy";
export type WalletChain = "bsc" | "sol";

export async function getWallet(
  chain: WalletChain,
  role: WalletRole,
): Promise<{ address: string; privKey: string } | null> {
  const rows = await db
    .select()
    .from(walletsTable)
    .where(and(eq(walletsTable.chain, chain), eq(walletsTable.role, role)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  if (!row.isActive) {
    logger.warn({ chain, role }, "Wallet found but is inactive");
    return null;
  }

  let privKey = "";
  if (row.encryptedPrivKey) {
    try {
      privKey = decryptPrivKey(row.encryptedPrivKey);
    } catch (err) {
      logger.error({ chain, role, err: String(err) }, "Failed to decrypt private key — NEVER log key material");
      return null;
    }
  } else {
    const envKey = `${chain.toUpperCase()}_${role.toUpperCase().replace("-", "_")}_PRIVKEY`;
    const fromEnv = process.env[envKey];
    if (fromEnv) {
      privKey = fromEnv;
    }
  }

  return { address: row.address, privKey };
}

export async function getOpsWallet(
  chain: WalletChain,
): Promise<{ address: string; privKey: string } | null> {
  const fromDb = await getWallet(chain, "ops_buy");
  if (fromDb) return fromDb;

  const addrEnv = chain === "bsc" ? "BSC_OPS_BUY_ADDRESS" : "SOL_OPS_BUY_ADDRESS";
  const keyEnv = chain === "bsc" ? "BSC_OPS_BUY_PRIVKEY" : "SOL_OPS_BUY_PRIVKEY";

  const address = process.env[addrEnv];
  const privKey = process.env[keyEnv];

  if (!address) {
    logger.warn({ chain }, `Ops wallet not found in DB or ${addrEnv}`);
    return null;
  }

  return { address, privKey: privKey ?? "" };
}
