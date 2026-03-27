import { db } from "@workspace/db";
import { trendTopicsTable, auditLogsTable } from "@workspace/db";
import { logger } from "../lib/logger";

interface TrendItem {
  topic: string;
  volume: number | null;
  source: string;
  rawData: Record<string, unknown>;
}

const MOCK_CRYPTO_TRENDS: string[] = [
  "#BTC",
  "#ETH",
  "#BNB",
  "#Solana",
  "#DeFi",
  "#Meme",
  "#NFT",
  "#Web3",
  "#PumpFun",
  "#BSC",
  "#Arbitrum",
  "#Base",
  "#LayerZero",
  "#AI_tokens",
  "#RWA",
];

async function fetchXTrendsViaApi(): Promise<TrendItem[]> {
  const bearerToken = process.env["TWITTER_BEARER_TOKEN"];
  if (!bearerToken) {
    throw new Error("TWITTER_BEARER_TOKEN not set");
  }

  const woeid = "1";
  const url = `https://api.twitter.com/1.1/trends/place.json?id=${woeid}`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });

  if (!resp.ok) {
    throw new Error(`Twitter API error: ${resp.status} ${resp.statusText}`);
  }

  const data = (await resp.json()) as Array<{
    trends: Array<{ name: string; tweet_volume: number | null }>;
  }>;

  const trends = data[0]?.trends ?? [];
  return trends.slice(0, 20).map((t) => ({
    topic: t.name,
    volume: t.tweet_volume,
    source: "x_api_v1",
    rawData: t as Record<string, unknown>,
  }));
}

function buildMockTrends(): TrendItem[] {
  const shuffled = [...MOCK_CRYPTO_TRENDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 10).map((topic, i) => ({
    topic,
    volume: Math.floor(Math.random() * 50000) + 1000,
    source: "mock_fallback",
    rawData: { mock: true, rank: i + 1 },
  }));
}

export async function collectTrends(): Promise<{
  saved: number;
  source: string;
  topics: string[];
}> {
  let items: TrendItem[];
  let source: string;

  try {
    items = await fetchXTrendsViaApi();
    source = "x_api_v1";
    logger.info({ count: items.length }, "Fetched trends from X API");
  } catch (err) {
    logger.warn({ err: String(err) }, "X API unavailable, using mock fallback");
    items = buildMockTrends();
    source = "mock_fallback";
  }

  if (items.length === 0) {
    return { saved: 0, source, topics: [] };
  }

  const rows = await db
    .insert(trendTopicsTable)
    .values(
      items.map((item) => ({
        topic: item.topic,
        source: item.source,
        region: "global",
        volume: item.volume ?? null,
        rawData: item.rawData,
        collectedAt: new Date(),
      })),
    )
    .returning();

  await db.insert(auditLogsTable).values({
    action: "trends_collected",
    entityType: "trend_topic",
    entityId: null,
    actor: "system",
    metadata: { count: rows.length, source, topics: rows.map((r) => r.topic) },
  });

  logger.info({ count: rows.length, source }, "Trends saved to DB");

  return {
    saved: rows.length,
    source,
    topics: rows.map((r) => r.topic),
  };
}
