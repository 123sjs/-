import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  trendTopicsTable,
  candidatesTable,
  launchJobsTable,
  auditLogsTable,
  walletsTable,
  insertWalletSchema,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { runCollectTrends } from "../jobs/collectTrends";
import { runBuildCandidates } from "../jobs/buildCandidates";
import { sendCandidateForApproval, isTelegramEnabled, sendLaunchResult } from "../services/telegramBot";
import { fourAdapter } from "../adapters/fourAdapter";
import { pumpAdapter } from "../adapters/pumpAdapter";

const router: IRouter = Router();

async function writeAuditLog(
  action: string,
  entityType: string | null,
  entityId: number | null,
  actor: string,
  metadata?: Record<string, unknown>,
) {
  await db.insert(auditLogsTable).values({
    action,
    entityType,
    entityId,
    actor,
    metadata: metadata ?? null,
  });
}

router.post("/admin/run-trends", async (_req, res) => {
  const result = await runCollectTrends();
  if (!result.ok) {
    res.status(500).json(result);
    return;
  }
  res.json(result);
});

router.post("/admin/run-candidates", async (req, res) => {
  const limit = Number(req.body?.limit ?? 5);
  const result = await runBuildCandidates(Math.min(Math.max(limit, 1), 20));
  if (!result.ok) {
    res.status(500).json(result);
    return;
  }
  res.json(result);
});

router.post("/admin/run-launch/:jobId", async (req, res) => {
  const jobId = Number(req.params["jobId"]);
  if (!jobId || Number.isNaN(jobId)) {
    res.status(400).json({ ok: false, error: "Invalid jobId" });
    return;
  }

  try {
    const [job] = await db
      .select()
      .from(launchJobsTable)
      .where(eq(launchJobsTable.id, jobId))
      .limit(1);

    if (!job) {
      res.status(404).json({ ok: false, error: "Launch job not found" });
      return;
    }

    if (job.status !== "pending") {
      res.status(409).json({ ok: false, error: `Job is already in status: ${job.status}` });
      return;
    }

    const [candidate] = await db
      .select()
      .from(candidatesTable)
      .where(eq(candidatesTable.id, job.candidateId))
      .limit(1);

    if (!candidate) {
      res.status(404).json({ ok: false, error: "Candidate not found for this job" });
      return;
    }

    const adapter = job.chain === "bsc" ? fourAdapter : pumpAdapter;
    const payload = {
      candidateId: candidate.id,
      jobId,
      tokenName: candidate.tokenName,
      tokenSymbol: candidate.tokenSymbol,
      description: candidate.description,
      logoUrl: candidate.logoUrl,
      buyTier: job.buyTier,
      chain: job.chain as "bsc" | "sol",
    };

    const validation = adapter.validate(payload);
    if (!validation.ok) {
      res.status(400).json({ ok: false, errors: validation.errors });
      return;
    }

    await db.update(launchJobsTable).set({ status: "deploying", updatedAt: new Date() }).where(eq(launchJobsTable.id, jobId));
    await writeAuditLog("launch_started", "launch_job", jobId, "api", { chain: job.chain, tokenName: candidate.tokenName });

    const launchResult = await adapter.launch(payload);

    if (!launchResult.ok) {
      await db.update(launchJobsTable).set({
        status: "failed",
        errorMessage: launchResult.errorMessage,
        updatedAt: new Date(),
      }).where(eq(launchJobsTable.id, jobId));
      await writeAuditLog("launch_failed", "launch_job", jobId, "api", { error: launchResult.errorMessage });
      res.status(500).json({ ok: false, error: launchResult.errorMessage });
      return;
    }

    await db.update(launchJobsTable).set({
      status: "deployed",
      platform: launchResult.platform,
      platformUrl: launchResult.platformUrl ?? null,
      launchMode: launchResult.launchMode,
      deepLink: launchResult.deepLink ?? null,
      instructions: launchResult.instructions ?? null,
      contractAddress: launchResult.contractAddress ?? null,
      deployTxHash: launchResult.deployTxHash ?? null,
      deployedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(launchJobsTable.id, jobId));
    await writeAuditLog("launch_deployed", "launch_job", jobId, "api", {
      platform: launchResult.platform,
      launchMode: launchResult.launchMode,
      contractAddress: launchResult.contractAddress,
      deployTxHash: launchResult.deployTxHash,
      deepLink: launchResult.deepLink,
    });

    let buyResult = null;
    if (job.buyTier) {
      await db.update(launchJobsTable).set({ status: "buying", updatedAt: new Date() }).where(eq(launchJobsTable.id, jobId));
      const opsBuyPayload = { ...payload, contractAddress: launchResult.contractAddress ?? job.contractAddress ?? null };
      const br = await adapter.opsBuy(opsBuyPayload);
      buyResult = br;

      await db.update(launchJobsTable).set({
        status: br.ok ? "bought" : (br.isStub ? "deployed" : "failed"),
        opsWalletLabel: br.walletLabel ?? null,
        buyTxHash: br.txHash ?? null,
        buyAmount: br.amountSpent ?? null,
        boughtAt: br.ok ? new Date() : null,
        errorMessage: br.ok ? null : (br.isStub ? `[stub] ${br.errorMessage}` : (br.errorMessage ?? null)),
        updatedAt: new Date(),
      }).where(eq(launchJobsTable.id, jobId));

      await writeAuditLog(br.ok ? "ops_buy_success" : (br.isStub ? "ops_buy_stub" : "ops_buy_failed"), "launch_job", jobId, "api", {
        tier: job.buyTier,
        txHash: br.txHash,
        amount: br.amountSpent,
        walletLabel: br.walletLabel,
        isStub: br.isStub,
        error: br.errorMessage,
      });
    } else {
      await db.update(launchJobsTable).set({ status: "bought", updatedAt: new Date() }).where(eq(launchJobsTable.id, jobId));
    }

    const [updatedJob] = await db.select().from(launchJobsTable).where(eq(launchJobsTable.id, jobId)).limit(1);
    if (updatedJob) {
      await sendLaunchResult(updatedJob, candidate.tokenName);
    }

    res.json({
      ok: true,
      jobId,
      chain: job.chain,
      platform: launchResult.platform,
      launchMode: launchResult.launchMode,
      deepLink: launchResult.deepLink,
      instructions: launchResult.instructions,
      contractAddress: launchResult.contractAddress,
      deployTxHash: launchResult.deployTxHash,
      buyResult,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/admin/notify-candidates", async (_req, res) => {
  if (!isTelegramEnabled()) {
    res.status(503).json({
      ok: false,
      error: "Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID.",
    });
    return;
  }

  try {
    const pending = await db
      .select()
      .from(candidatesTable)
      .where(eq(candidatesTable.status, "pending_review"))
      .orderBy(desc(candidatesTable.createdAt))
      .limit(10);

    let sent = 0;
    const errors: string[] = [];

    for (const candidate of pending) {
      const ok = await sendCandidateForApproval(candidate);
      if (ok) sent++;
      else errors.push(`candidate #${candidate.id}`);
    }

    res.json({ ok: true, sent, total: pending.length, errors });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/admin/candidates", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(candidatesTable)
      .orderBy(desc(candidatesTable.createdAt))
      .limit(50);

    res.json({ ok: true, candidates: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/admin/launch-jobs", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(launchJobsTable)
      .orderBy(desc(launchJobsTable.createdAt))
      .limit(50);

    res.json({ ok: true, launchJobs: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/admin/wallets", async (_req, res) => {
  try {
    const rows = await db.select().from(walletsTable);
    res.json({ ok: true, wallets: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/admin/wallets", async (req, res) => {
  const parsed = insertWalletSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: parsed.error.message });
    return;
  }

  const { chain, role } = parsed.data;
  const allowedRoles = ["deployer", "treasury", "ops_buy"];
  const allowedChains = ["bsc", "sol"];

  if (!allowedChains.includes(chain)) {
    res.status(400).json({ ok: false, error: `chain must be one of: ${allowedChains.join(", ")}` });
    return;
  }
  if (!allowedRoles.includes(role)) {
    res.status(400).json({ ok: false, error: `role must be one of: ${allowedRoles.join(", ")}` });
    return;
  }

  try {
    const chainWallets = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.chain, chain));

    const roleExists = chainWallets.find((w) => w.role === role);
    if (roleExists) {
      res.status(409).json({
        ok: false,
        error: `A ${role} wallet for chain ${chain} already exists (id: ${roleExists.id}). Deactivate it first.`,
      });
      return;
    }

    const [inserted] = await db.insert(walletsTable).values(parsed.data).returning();
    await writeAuditLog("wallet_registered", "wallet", inserted!.id, "api", {
      chain,
      role,
      address: parsed.data.address,
    });

    res.status(201).json({ ok: true, wallet: inserted });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.patch("/admin/candidates/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (!id || Number.isNaN(id)) {
    res.status(400).json({ ok: false, error: "Invalid candidate id" });
    return;
  }

  const allowed = ["tokenName", "tokenSymbol", "description"] as const;
  type AllowedKey = typeof allowed[number];
  const updates: Partial<Record<AllowedKey, string>> = {};

  for (const key of allowed) {
    if (key in req.body && typeof req.body[key] === "string" && (req.body[key] as string).trim().length > 0) {
      updates[key] = (req.body[key] as string).trim();
    }
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ ok: false, error: "No valid fields to update (allowed: tokenName, tokenSymbol, description)" });
    return;
  }

  try {
    const [existing] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ ok: false, error: "Candidate not found" });
      return;
    }

    const [updated] = await db
      .update(candidatesTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(candidatesTable.id, id))
      .returning();

    await writeAuditLog("candidate_edited", "candidate", id, "admin_api", { updates, previous: { tokenName: existing.tokenName, tokenSymbol: existing.tokenSymbol, description: existing.description } });

    res.json({ ok: true, candidate: updated });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.patch("/admin/launch-jobs/:id/contract", async (req, res) => {
  const id = Number(req.params["id"]);
  if (!id || Number.isNaN(id)) {
    res.status(400).json({ ok: false, error: "Invalid job id" });
    return;
  }

  const { contractAddress } = req.body as { contractAddress?: string };
  if (!contractAddress || !contractAddress.trim()) {
    res.status(400).json({ ok: false, error: "contractAddress is required" });
    return;
  }

  try {
    const [job] = await db.select().from(launchJobsTable).where(eq(launchJobsTable.id, id)).limit(1);
    if (!job) {
      res.status(404).json({ ok: false, error: "Launch job not found" });
      return;
    }

    const [updated] = await db
      .update(launchJobsTable)
      .set({ contractAddress: contractAddress.trim(), updatedAt: new Date() })
      .where(eq(launchJobsTable.id, id))
      .returning();

    await writeAuditLog("launch_job_contract_updated", "launch_job", id, "admin_api", { contractAddress: contractAddress.trim() });

    res.json({ ok: true, launchJob: updated });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/admin/audit-logs", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(auditLogsTable)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(100);

    res.json({ ok: true, logs: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/admin/trends", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(trendTopicsTable)
      .orderBy(desc(trendTopicsTable.collectedAt))
      .limit(50);

    res.json({ ok: true, trends: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
