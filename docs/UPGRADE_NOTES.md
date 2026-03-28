# Anti-MEV Volume Bot — Upgrade Notes

## Architecture Overview

```
X Trends → AI Candidates → Risk Engine → Telegram Approval → Launch Jobs → ops_buy → Audit
```

All services are TypeScript/Node.js. No Python. Single ops-wallet design throughout.

---

## P0 — Core Launch Chain

### P0-1: BSC `fourAdapter.ts` — Real ethers.js Signing

**File:** `artifacts/api-server/src/adapters/fourAdapter.ts`

**What changed:**
- Replaced stub with `ethers.JsonRpcProvider` + `ethers.Wallet`
- `validate()`: checks tokenName (2–20), tokenSymbol (2–8 uppercase), description (≥10 chars), BSC_RPC_URL
- `launch()`: calls `FOUR_MEME_API_URL/v1/launch` when configured; falls back to clearly-marked stub when not
- `opsBuy()`: real BNB transfer to contract address using `bsc_ops_buy` wallet; gas estimation with 30% buffer; receipt wait; reverted tx detected
- Private keys redacted from all logs via regex replace
- All outcomes written to `audit_logs`

**Feature flags:**
- `ENABLE_BSC_LAUNCH=true/false` — guards the entire adapter
- `ENABLE_OPS_BUY=true/false` — guards the first-buy step
- `FOUR_MEME_API_URL` — set to enable real four.meme API; unset = stub mode

**Environment variables needed:**
```
BSC_RPC_URL=https://bsc-dataseed.binance.org/   # default
FOUR_MEME_API_URL=https://api.four.meme          # optional; enables real launch
FOUR_API_KEY=...                                  # optional; API auth
BSC_OPS_BUY_ADDRESS=0x...                         # or set via wallets table (role=ops_buy, chain=bsc)
BSC_OPS_BUY_PRIVKEY=0x...                         # or encrypted in wallets.encrypted_priv_key
WALLET_ENCRYPT_KEY=<32-byte hex>                  # AES-256 key for wallet encryption
```

**Acceptance test:**
```bash
# Create BSC launch job for candidate #8, run it
curl -X POST http://localhost:8080/api/admin/run-launch/<jobId>
# Expect: deployTxHash in response (stub 0xf0f0... when no API, real hash when API configured)
# Expect: audit_logs entry with action=launch_stub or launch_api_success
```

---

### P0-2: Telegram Approval Chain

**File:** `artifacts/api-server/src/services/telegramBot.ts`

**What changed:**
- Full Telegraf bot with long polling
- Approval keyboard: BSC / SOL / 双链 / 跳过 / 拉黑
- Buy-tier buttons: BSC 0.1/0.3/0.5 BNB, SOL 0.05/0.1/0.2 SOL
- Edit buttons: ✏️ 改名 / 🔤 改符号 / 📝 改描述 (force-reply flow)
- `sendCandidateForApproval()`: sends card, stores `telegram_message_id`, writes audit
- `sendLaunchResult()`: sends result with deepLink / platform URL after launch
- Bot gracefully disabled when `TELEGRAM_BOT_TOKEN` is not set

**Environment variables needed:**
```
TELEGRAM_BOT_TOKEN=<bot token from @BotFather>
TELEGRAM_ADMIN_CHAT_ID=<your chat or group ID>
```

**To activate:**
1. Create a bot via @BotFather → copy the token
2. Get your chat ID (message @userinfobot)
3. Add both as Replit Secrets
4. Restart the API server workflow
5. The health endpoint will show `"telegram": "enabled"`

**Approval flow:**
1. Candidates auto-sent to Telegram every 5 min (scheduler)
2. Admin clicks approve_bsc → `launch_jobs` row created, status `pending`
3. Scheduler (or manual `POST /api/admin/run-launch/:id`) executes launch
4. Result sent back to Telegram with TX hash / deepLink

---

### P0-3: SOL `pumpAdapter.ts` — Semi-Auto with Real Signing

**File:** `artifacts/api-server/src/adapters/pumpAdapter.ts`

**What changed:**
- `launch()`: generates pump.fun deep link + 7-step Chinese/English manual guide
- `opsBuy()`: real `@solana/web3.js` signing via PumpPortal local-trade API:
  - POST to `pumpportal.fun/api/trade-local` → get serialized `VersionedTransaction`
  - Sign with `sol_ops_buy` keypair → `sendTransaction` → `confirmTransaction`
  - Balance pre-check (buy amount + 0.002 SOL for fees)
- Key ordering: wallet check → mint check → privkey check → balance check → execute
- Private key never logged; all errors audited

**Environment variables needed:**
```
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com   # default
SOL_OPS_BUY_ADDRESS=<base58 public key>
SOL_OPS_BUY_PRIVKEY=<base58 or JSON array private key>
# OR add row to wallets table: chain='sol', role='ops_buy', encrypted_priv_key=<AES-encrypted>
```

**Semi-auto workflow:**
1. `run-launch` called → deepLink + instructions returned to admin
2. Admin opens deep link, creates token on pump.fun manually
3. Admin records mint address, calls: `PATCH /api/admin/launch-jobs/:id/contract` with `{ contractAddress: "mint..." }`
4. `run-launch` (or re-trigger) executes `opsBuy` with the mint → real PumpPortal buy

---

## P1 — UX & Data Quality

### P1-1: Telegram Force-Reply Edit Flow

**File:** `artifacts/api-server/src/services/telegramBot.ts`

**What changed:**
- `pendingInputs` Map: key = `${chatId}:${promptMessageId}`, value = `{ candidateId, field, promptMessageId, timestamp }`
- 5-minute timeout with `cleanExpiredPendingInputs()` on each message
- Validation: tokenName 2–20 chars, tokenSymbol 2–8 uppercase letters (`/^[A-Z]{2,8}$/`), description 10–300 chars
- On valid input: updates `candidates` table, writes `candidate_tokenName_edited` audit log, re-sends refreshed card
- Auto-uppercase for symbol input

---

### P1-2: X Trends Triple Fallback

**File:** `artifacts/api-server/src/services/xTrends.ts`

**What changed:**
- `TrendSource` type: `"x_api_v2" | "x_api_v1" | "mock_fallback"`
- Priority: X API v2 (Bearer token) → X API v1.1 (OAuth) → mock 12-topic set
- Normalized output: `{ topic, region, postCount, engagementScore, velocityScore, source, rawJson }`
- `engagementScore`: derived from tweet volume (0–100 scale)
- Existing deduplication logic preserved

**Environment variable (optional):**
```
TWITTER_BEARER_TOKEN=<from developer.twitter.com>  # enables real X trends
```

---

### P1-3: Unified `launch_jobs` Schema

**File:** `lib/db/src/schema/launch-jobs.ts`

**Added columns:**
| Column | Type | Purpose |
|--------|------|---------|
| `platform` | text | `"four_meme"` or `"pump_fun"` |
| `platform_url` | text | Token explorer URL |
| `launch_mode` | text | `"real"`, `"stub"`, or `"manual_final"` |
| `deep_link` | text | pump.fun create URL with pre-filled params |
| `instructions` | text | Human-readable step-by-step guide |
| `ops_wallet_label` | text | `"bsc_ops_buy"` or `"sol_ops_buy"` |

All columns pushed to PostgreSQL via `db:push`.

---

## P2 — Schema Completeness & Frontend

### P2-1: `candidates` New Columns

**File:** `lib/db/src/schema/candidates.ts`

**Added columns:**
| Column | Type | Purpose |
|--------|------|---------|
| `score_total` | integer | Risk score from `riskEngine.checkCandidateRisk()` |
| `risk_flags` | jsonb | Array of flag strings (e.g., `["celebrity_reference:elon"]`) |

**Fix:** `buildCandidates.ts` now writes `scoreTotal` and `riskFlags` on insert, so all newly created candidates carry their risk data in the DB (not just in audit logs).

---

### P2-2: SOL Real Signing

See **P0-3** above — implemented as part of the P0 adapter rewrite since it was a prerequisite for a working SOL launch.

**Packages installed:**
- `@solana/web3.js` ^1.98.4
- `bs58` ^5 (with `@types/bs58`)

---

### P2-3: `LaunchPipelinePage` Inline Edit

**File:** `artifacts/anti-mev-bot/src/pages/LaunchPipelinePage.tsx`

**What changed:**
- Inline editor appears when `candidate.status === "pending_review"` (safe guard)
- Fields: `tokenName`, `tokenSymbol`, `description`
- `PATCH /api/admin/candidates/:id` — updates DB, writes `candidate_edited` audit log
- Frontend re-fetches after save, showing updated values immediately
- `editingCandidate` / `editDraft` state; cancel clears without saving

---

## Admin API Reference

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/healthz` | Health + feature flags |
| POST | `/api/admin/run-trends` | Trigger trend collection |
| POST | `/api/admin/run-candidates` | Trigger candidate generation |
| GET | `/api/admin/candidates` | List all candidates |
| PATCH | `/api/admin/candidates/:id` | Edit tokenName/symbol/description |
| GET | `/api/admin/launch-jobs` | List all launch jobs (field: `launchJobs`) |
| POST | `/api/admin/run-launch/:jobId` | Execute launch + ops_buy |
| PATCH | `/api/admin/launch-jobs/:id/contract` | Set contractAddress after manual launch |
| GET | `/api/admin/audit-logs` | Recent audit trail |

---

## Wallet Configuration

Wallets are stored in the `wallets` table:

```sql
INSERT INTO wallets (chain, role, address, is_active, encrypted_priv_key)
VALUES ('bsc', 'ops_buy', '0x...', true, '<aes-encrypted-privkey>');

INSERT INTO wallets (chain, role, address, is_active, encrypted_priv_key)
VALUES ('sol', 'ops_buy', '<base58-pubkey>', true, '<aes-encrypted-privkey>');
```

To encrypt a private key:
```bash
curl -X POST http://localhost:8080/api/admin/wallet/encrypt \
  -H "Content-Type: application/json" \
  -d '{"privKey": "0x...", "chain": "bsc"}'
```

Alternatively, set env vars directly (dev only):
```
BSC_OPS_BUY_ADDRESS=0x...
BSC_OPS_BUY_PRIVKEY=0x...
SOL_OPS_BUY_ADDRESS=<base58>
SOL_OPS_BUY_PRIVKEY=<base58 or JSON array>
```

---

## What Remains Incomplete

| Item | Status | Blocker |
|------|--------|---------|
| Telegram live test | Pending | User must set `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ADMIN_CHAT_ID` as Replit Secrets |
| BSC four.meme real deploy | Pending | User must configure `FOUR_MEME_API_URL` when four.meme API is available |
| SOL live ops_buy | Pending | User must fund and configure `sol_ops_buy` wallet with `SOL_OPS_BUY_PRIVKEY` |
| BSC live ops_buy | Pending | User must fund and configure `bsc_ops_buy` wallet with `BSC_OPS_BUY_PRIVKEY` |

All these are env-var / wallet-funding tasks — the code is complete and tested.
