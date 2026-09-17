import Anthropic from "@anthropic-ai/sdk";

const globalForAnthropic = globalThis as unknown as {
  anthropic: Anthropic | undefined;
};

export const anthropic =
  globalForAnthropic.anthropic ??
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

if (process.env.NODE_ENV !== "production") {
  globalForAnthropic.anthropic = anthropic;
}

// Guards against a very plausible copy-paste mistake for a non-technical
// user: pasting the whole `ANTHROPIC_MODEL="..."` line (quotes included)
// from a .env file into Vercel's plain-value environment variable field
// silently turns the model ID into `"claude-..."` with literal quote
// characters, which Anthropic's API rejects outright.
function sanitizeModelId(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/^['"]|['"]$/g, "");
}

export const TEACHER_MODEL = sanitizeModelId(process.env.ANTHROPIC_MODEL) || "claude-haiku-4-5-20251001";
