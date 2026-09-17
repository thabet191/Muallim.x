import Anthropic from "@anthropic-ai/sdk";

// Guards against a very plausible copy-paste mistake for a non-technical
// user: pasting the whole `NAME="value"` line (quotes included) from a
// .env file into Vercel's plain-value environment variable field silently
// turns the value into `"actual-value"` with literal quote characters,
// which Anthropic's API rejects outright — whether that's the model ID or
// the API key itself.
function sanitizeEnvValue(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/^['"]|['"]$/g, "");
}

const globalForAnthropic = globalThis as unknown as {
  anthropic: Anthropic | undefined;
};

export const anthropic =
  globalForAnthropic.anthropic ??
  new Anthropic({ apiKey: sanitizeEnvValue(process.env.ANTHROPIC_API_KEY) });

if (process.env.NODE_ENV !== "production") {
  globalForAnthropic.anthropic = anthropic;
}

export const TEACHER_MODEL = sanitizeEnvValue(process.env.ANTHROPIC_MODEL) || "claude-haiku-4-5-20251001";
