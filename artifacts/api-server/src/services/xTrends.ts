import { db } from "@workspace/db";
import { trendTopicsTable, auditLogsTable } from "@workspace/db";
import { logger } from "../lib/logger";

export type TrendSource = "x_api_v2" | "x_api_v1" | "mock_fallback";

export interface TrendItem {
  topic: string;
  volume: number | null;
  region: string;
  engagementScore: number | null;
  velocityScore: number | null;
  source: TrendSource;
  rawData: Record<string, unknown>;
}

const MOCK_CRYPTO_TRENDS: string[] = [
  "#BTC", "#ETH", "#BNB", "#Solana", "#DeFi",
  "#Meme", "#NFT", "#Web3", "#PumpFun", "#BSC",
  "#Arbitrum", "#Base", "#LayerZero", "#AI_tokens", "#RWA",
  "#memecoin", "#altcoins", "#PEPE", "#Dogecoin", "#GameFi",
];

async function fetchXTrendsV2(): Promise<TrendItem[]> {
  const bearerToken = process.env["TWITTER_BEARER_TOKEN"];
  if (!bearerToken) throw new Error("TWITTER_BEARER_TOKEN not set");

  const woeid = process.env["TWITTER_WOEID"] ?? "1";
  const url = `https://api.twitter.com/2/trends/by/woeid/${woeid}`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${bearerToken}` },
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Twitter v2 API ${resp.status}: ${errText.slice(0, 100)}`);
  }

  const data = await resp.json() as {
    data?: Array<{ name: string; tweet_count?: number; trend_volume?: number }>;
  };

  const trends = data.data ?? [];
  return trends.slice(0, 20).map((t) => {
    const vol = t.tweet_count ?? t.trend_volume ?? null;
    return {
      topic: t.name,
      volume: vol,
      region: woeid === "1" ? "global" : woeid,
      engagementScore: vol ? Math.min(100, Math.floor(vol / 1000)) : null,
      velocityScore: null,
      source: "x_api_v2" as TrendSource,
      rawData: t as Record<string, unknown>,
    };
  });
}

async function fetchXTrendsV1(): Promise<TrendItem[]> {
  const bearerToken = process.env["TWITTER_BEARER_TOKEN"];
  if (!bearerToken) throw new Error("TWITTER_BEARER_TOKEN not set");

  const woeid = process.env["TWITTER_WOEID"] ?? "1";
  const url = `https://api.twitter.com/1.1/trends/place.json?id=${woeid}`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${bearerToken}` },
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Twitter v1 API ${resp.status}: ${errText.slice(0, 100)}`);
  }

  const data = (await resp.json()) as Array<{
    trends: Array<{ name: string; tweet_volume: number | null }>;
  }>;

  const region = woeid === "1" ? "global" : woeid;
  const trends = data[0]?.trends ?? [];
  return trends.slice(0, 20).map((t) => ({
    topic: t.name,
    volume: t.tweet_volume,
    region,
    engagementScore: t.tweet_volume ? Math.min(100, Math.floor(t.tweet_volume / 1000)) : null,
    velocityScore: null,
    source: "x_api_v1" as TrendSource,
    rawData: t as Record<string, unknown>,
  }));
}

function buildMockTrends(): TrendItem[] {
  const shuffled = [...MOCK_CRYPTO_TRENDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 12).map((topic, i) => {
    const vol = Math.floor(Math.random() * 80_000) + 1_000;
    return {
      topic,
      volume: vol,
      region: "global",
      engagementScore: Math.min(100, Math.floor(vol / 1000)),
      velocityScore: Math.floor(Math.random() * 100),
      source: "mock_fallback" as TrendSource,
      rawData: { mock: true, rank: i + 1 },
    };
  });
}

async function fetchWithFallback(): Promise<{ items: TrendItem[]; source: TrendSource }> {
  if (!process.env["TWITTER_BEARER_TOKEN"]) {
    logger.info("TWITTER_BEARER_TOKEN not set — using mock trends");
    return { items: buildMockTrends(), source: "mock_fallback" };
  }

  try {
    const items = await fetchXTrendsV2();
    logger.info({ count: items.length }, "Fetched trends from X API v2");
    return { items, source: "x_api_v2" };
  } catch (v2Err) {
    logger.warn({ err: String(v2Err) }, "Twitter v2 failed, trying v1");
    try {
      const items = await fetchXTrendsV1();
      logger.info({ count: items.length }, "Fetched trends from X API v1");
      return { items, source: "x_api_v1" };
    } catch (v1Err) {
      logger.warn({ err: String(v1Err) }, "Twitter v1 also failed — mock fallback");
      return { items: buildMockTrends(), source: "mock_fallback" };
    }
  }
}

export async function collectTrends(): Promise<{
  saved: number;
  source: TrendSource;
  topics: string[];
}> {
  const { items, source } = await fetchWithFallback();

  if (items.length === 0) {
    return { saved: 0, source, topics: [] };
  }

  const rows = await db
    .insert(trendTopicsTable)
    .values(
      items.map((item) => ({
        topic: item.topic,
        source: item.source,
        region: item.region,
        volume: item.volume ?? null,
        rawData: {
          ...item.rawData,
          engagementScore: item.engagementScore,
          velocityScore: item.velocityScore,
        },
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

  return { saved: rows.length, source, topics: rows.map((r) => r.topic) };
}
