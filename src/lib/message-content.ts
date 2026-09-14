export type MessagePart =
  | { type: "text"; value: string }
  | { type: "svg"; value: string };

const SVG_FENCE_RE = /```svg\s*([\s\S]*?)```/g;

/** Splits an assistant message into plain-text and ```svg fenced blocks. */
export function parseMessageParts(content: string): MessagePart[] {
  const parts: MessagePart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  SVG_FENCE_RE.lastIndex = 0;
  while ((match = SVG_FENCE_RE.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: "svg", value: match[1] });
    lastIndex = SVG_FENCE_RE.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", value: content.slice(lastIndex) });
  }

  return parts;
}

/**
 * Strips markdown noise and collapses blank lines/paragraph breaks so TTS
 * doesn't stutter between chunks, and drops SVG code blocks entirely (they
 * have nothing worth speaking).
 */
export function cleanTextForSpeech(content: string): string {
  return content
    .replace(SVG_FENCE_RE, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_#>`]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(". ")
    .replace(/\s+/g, " ")
    .replace(/\.\s*\./g, ".")
    .trim();
}

/** Splits cleaned text into sentence-ish chunks for smoother TTS queueing. */
export function splitIntoSpeechChunks(text: string): string[] {
  const chunks = text
    .split(/(?<=[.!?؟。])\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return chunks.length > 0 ? chunks : [text].filter(Boolean);
}
