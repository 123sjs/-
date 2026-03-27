import { logger } from "../lib/logger";

export type ImageSize = "1024x1024" | "512x512" | "256x256";

export async function generateTokenLogo(
  tokenName: string,
  tokenSymbol: string,
  narrative: string,
): Promise<string> {
  try {
    const { generateImageBuffer } = await import(
      "@workspace/integrations-openai-ai-server/image"
    );

    const prompt = `Minimalist cryptocurrency token logo for "${tokenName}" (${tokenSymbol}). ${narrative}. Clean vector style, single icon, no text, suitable for DeFi token. White background, bold colors.`;

    const buffer = await generateImageBuffer(prompt, "256x256");
    const b64 = buffer.toString("base64");
    return `data:image/png;base64,${b64}`;
  } catch (err) {
    logger.warn({ err: String(err), tokenName }, "Image generation failed, using placeholder");
    return buildPlaceholderUrl(tokenSymbol);
  }
}

function buildPlaceholderUrl(symbol: string): string {
  const encoded = encodeURIComponent(symbol.slice(0, 4).toUpperCase());
  return `https://placehold.co/256x256/1a2332/00c853?text=${encoded}&font=montserrat`;
}
