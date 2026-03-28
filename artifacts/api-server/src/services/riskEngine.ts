import { logger } from "../lib/logger";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export interface RiskCheckResult {
  passed: boolean;
  flags: string[];
  score: number;
}

const CELEBRITY_NAMES = [
  "elon", "musk", "trump", "biden", "obama", "bezos", "zuckerberg", "gates",
  "buffett", "soros", "vitalik", "buterin", "satoshi", "nakamoto", "xi",
  "putin", "modi", "macron", "merkel", "johnson", "dorsey", "altman",
];

const BRAND_TERMS = [
  "apple", "google", "amazon", "microsoft", "tesla", "nvidia", "meta",
  "twitter", "tiktok", "youtube", "facebook", "instagram",
  "paypal", "visa", "mastercard", "binance", "coinbase", "opensea",
  "uniswap", "aave", "compound", "chainlink",
];

const POLITICAL_TERMS = [
  "communist", "nazi", "fascist", "jihad", "isis", "terrorism", "coup",
  "revolution", "assassination", "genocide", "militia", "supremacy",
  "maga", "antifa", "woke", "dictator",
];

const DISASTER_TERMS = [
  "earthquake", "tsunami", "hurricane", "famine", "pandemic", "plague",
  "war", "warfare", "wartime", "nuclear", "explosion", "crash", "collapse", "bankrupt",
  "fukushima", "chernobyl", "titanic",
];

const SCAM_TERMS = [
  "rug", "rugpull", "honeypot", "pump", "dump", "fake", "scam", "fraud",
  "ponzi", "exit", "infinite mint", "100x guaranteed", "1000x", "moonshot",
  "safe moon", "elonspeed", "dogewifhat", "rich quick",
];

const DUPLICATE_COOLDOWN_HOURS = 72;

const recentTopics = new Map<string, number>();

function containsAnyTerm(text: string, terms: string[]): string[] {
  const matched: string[] = [];
  for (const term of terms) {
    // Use word-boundary regex so "war" does NOT match inside "reward", "forward", etc.
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    if (re.test(text)) {
      matched.push(term);
    }
  }
  return matched;
}

export function checkCandidateRisk(
  tokenName: string,
  tokenSymbol: string,
  description: string,
  narrative: string,
  topicText: string,
): RiskCheckResult {
  const flags: string[] = [];
  const fullText = `${tokenName} ${tokenSymbol} ${description} ${narrative} ${topicText}`;

  const celebMatches = containsAnyTerm(fullText, CELEBRITY_NAMES);
  if (celebMatches.length > 0) {
    flags.push(`celebrity_reference:${celebMatches.join(",")}`);
  }

  const brandMatches = containsAnyTerm(fullText, BRAND_TERMS);
  if (brandMatches.length > 0) {
    flags.push(`brand_term:${brandMatches.join(",")}`);
  }

  const politicalMatches = containsAnyTerm(fullText, POLITICAL_TERMS);
  if (politicalMatches.length > 0) {
    flags.push(`political_term:${politicalMatches.join(",")}`);
  }

  const disasterMatches = containsAnyTerm(fullText, DISASTER_TERMS);
  if (disasterMatches.length > 0) {
    flags.push(`disaster_term:${disasterMatches.join(",")}`);
  }

  const scamMatches = containsAnyTerm(fullText, SCAM_TERMS);
  if (scamMatches.length > 0) {
    flags.push(`scam_term:${scamMatches.join(",")}`);
  }

  const topicKey = normalize(topicText);
  const lastSeen = recentTopics.get(topicKey);
  if (lastSeen) {
    const hoursSince = (Date.now() - lastSeen) / 3_600_000;
    if (hoursSince < DUPLICATE_COOLDOWN_HOURS) {
      flags.push(`duplicate_topic_cooldown:${Math.round(hoursSince)}h_ago`);
    }
  }

  const symbolIsReserved = ["BTC", "ETH", "BNB", "SOL", "USDT", "USDC", "BUSD"].includes(
    tokenSymbol.toUpperCase(),
  );
  if (symbolIsReserved) {
    flags.push(`reserved_symbol:${tokenSymbol}`);
  }

  const score = flags.length;
  const passed = score === 0;

  if (!passed) {
    logger.warn({ tokenName, tokenSymbol, flags }, "Risk check failed");
  }

  recentTopics.set(topicKey, Date.now());

  return { passed, flags, score };
}

export function clearRiskCooldowns(): void {
  const cutoff = Date.now() - DUPLICATE_COOLDOWN_HOURS * 3_600_000;
  for (const [key, ts] of recentTopics.entries()) {
    if (ts < cutoff) recentTopics.delete(key);
  }
}

/**
 * 风险引擎自检：输出 4 条最小测试用例结果。
 * 在服务启动时调用，用于验证 word-boundary 修复和链名白名单是否正确。
 */
export function runRiskEngineTests(): void {
  const cases: Array<{ label: string; text: string; term: string[]; expectMatch: boolean }> = [
    { label: "reward 不应命中 war",       text: "staking rewards for users",  term: DISASTER_TERMS, expectMatch: false },
    { label: "warfare 应命中 war",         text: "warfare strategy token",     term: DISASTER_TERMS, expectMatch: true  },
    { label: "Solana 不应被品牌词拦截",    text: "Solana meme token launch",   term: BRAND_TERMS,    expectMatch: false },
    { label: "BNB ecosystem 不应被品牌词拦截", text: "BNB ecosystem rewards",  term: BRAND_TERMS,    expectMatch: false },
  ];

  let passed = 0;
  let failed = 0;

  for (const c of cases) {
    const matched = containsAnyTerm(c.text, c.term);
    const didMatch = matched.length > 0;
    const ok = didMatch === c.expectMatch;
    if (ok) {
      passed++;
      logger.info({ 测试: c.label, 结果: "✅ 通过", 匹配词: matched.length > 0 ? matched : "无" }, "【风控自检】");
    } else {
      failed++;
      logger.error({ 测试: c.label, 结果: "❌ 失败", 期望命中: c.expectMatch, 实际命中: didMatch, 匹配词: matched }, "【风控自检】");
    }
  }

  if (failed === 0) {
    logger.info({ 通过: passed, 失败: failed }, "【风控自检】全部通过");
  } else {
    logger.error({ 通过: passed, 失败: failed }, "【风控自检】存在失败项，请检查风控逻辑");
  }
}
