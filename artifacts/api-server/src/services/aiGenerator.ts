import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";

export interface CandidatePayload {
  tokenName: string;
  tokenSymbol: string;
  description: string;
  narrative: string;
  riskLevel: "low" | "medium" | "high";
  suggestedChain: "bsc" | "sol" | "both";
}

const SYSTEM_PROMPT = `You are a creative naming assistant for blockchain projects. Given a trending hashtag or topic, invent a fictional cryptocurrency token concept.

Respond with ONLY a JSON object, no markdown, no explanation, no code fences.

JSON schema:
{
  "tokenName": string,   // 2-20 chars, creative name inspired by the topic
  "tokenSymbol": string, // 2-8 uppercase letters only
  "description": string, // 50-200 chars describing what the token does
  "narrative": string,   // 30-100 chars, short catchy tagline
  "riskLevel": "low" | "medium" | "high",
  "suggestedChain": "bsc" | "sol" | "both"
}`;

export async function generateCandidate(topic: string): Promise<CandidatePayload> {
  const userPrompt = `Trending topic: "${topic}". Generate a fictional crypto token concept as JSON.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 8192,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const choice = response.choices[0];
  const finishReason = choice?.finish_reason;
  const raw = choice?.message?.content ?? "";
  const refusal = choice?.message?.refusal ?? null;

  logger.info({ topic, finishReason, rawLength: raw.length, raw: raw.slice(0, 200), refusal, model: response.model }, "AI response received");

  if (!raw) {
    if (refusal) {
      throw new Error(`AI refused: ${refusal}`);
    }
    throw new Error(`AI returned empty content. finishReason=${finishReason}, model=${response.model}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`AI output is not valid JSON. Raw: ${raw.slice(0, 200)}`);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`AI output is not a JSON object. Raw: ${raw.slice(0, 200)}`);
  }

  const p = parsed as Record<string, unknown>;

  const tokenName = String(p["tokenName"] ?? "").trim();
  const tokenSymbol = String(p["tokenSymbol"] ?? "").trim().toUpperCase();
  const description = String(p["description"] ?? "").trim();
  const narrative = String(p["narrative"] ?? "").trim();
  const riskLevel = (["low", "medium", "high"].includes(String(p["riskLevel"])) ? p["riskLevel"] : "medium") as "low" | "medium" | "high";
  const suggestedChain = (["bsc", "sol", "both"].includes(String(p["suggestedChain"])) ? p["suggestedChain"] : "bsc") as "bsc" | "sol" | "both";

  if (!tokenName || !tokenSymbol || !description || !narrative) {
    throw new Error(`AI output missing required fields. Parsed: ${JSON.stringify(p)}`);
  }

  return { tokenName, tokenSymbol, description, narrative, riskLevel, suggestedChain };
}
