export type MessagePart =
  | { type: "text"; value: string }
  | { type: "svg"; value: string };

const SVG_FENCE_RE = /```svg\s*([\s\S]*?)```/g;

/**
 * Rewrites common LaTeX math notation into plain text that both displays
 * sensibly (no literal backslashes/braces) and reads naturally out loud.
 * The teacher is told never to use LaTeX, but that's a prompt instruction,
 * not a guarantee — this is the deterministic backstop for whenever it
 * slips through anyway, since a raw "$$\frac{72}{8}...$$" is unreadable
 * on screen and gets spoken character-by-character by TTS.
 */
export function convertLatexMath(text: string): string {
  return text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, inner: string) => inner)
    .replace(/\$([^$\n]+?)\$/g, (_, inner: string) => inner)
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)")
    .replace(/\\sqrt\{([^{}]+)\}/g, "√($1)")
    .replace(/\\sqrt(\d+)/g, "√$1")
    .replace(/\\left|\\right/g, "")
    .replace(/\\times|\\cdot/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\pm/g, "±")
    .replace(/\\leq/g, "≤")
    .replace(/\\geq/g, "≥")
    .replace(/\\neq/g, "≠")
    .replace(/\\approx/g, "≈")
    .replace(/\\infty/g, "∞")
    .replace(/\\pi/g, "π")
    .replace(/\\rightarrow|\\to/g, "→")
    .replace(/\^\{([^{}]+)\}/g, "^$1")
    .replace(/_\{([^{}]+)\}/g, "_$1")
    .replace(/\\([a-zA-Z]+)/g, "$1");
}

/** Splits an assistant message into plain-text and ```svg fenced blocks. */
export function parseMessageParts(content: string): MessagePart[] {
  const parts: MessagePart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  SVG_FENCE_RE.lastIndex = 0;
  while ((match = SVG_FENCE_RE.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: convertLatexMath(content.slice(lastIndex, match.index)) });
    }
    parts.push({ type: "svg", value: match[1] });
    lastIndex = SVG_FENCE_RE.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", value: convertLatexMath(content.slice(lastIndex)) });
  }

  return parts;
}

/** Finds the most recent SVG diagram across a list of messages, if any. */
export function findLastSvg(messages: { role: string; content: string }[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant") continue;
    const svgPart = parseMessageParts(message.content).find((part) => part.type === "svg");
    if (svgPart) return svgPart.value;
  }
  return null;
}

/**
 * Android's default TTS engine (and several others) will read a bare math
 * symbol using its own hardcoded English word ("plus", "equals"...) even
 * while speaking with an Arabic voice, which is exactly the "switches to
 * English mid-sentence" behavior students notice. Spelling operators out as
 * the Arabic words a human teacher would say means the speech engine never
 * sees a raw symbol to guess a pronunciation for. This only feeds
 * cleanTextForSpeech — the symbols stay as-is in the text shown on screen.
 */
const MATH_SPEECH_REPLACEMENTS: Array<[RegExp, string]> = [
  [/±/g, " زائد أو ناقص "],
  [/≤/g, " أصغر من أو يساوي "],
  [/≥/g, " أكبر من أو يساوي "],
  [/≠/g, " لا يساوي "],
  [/≈/g, " تقريبًا يساوي "],
  [/×/g, " في "],
  [/÷/g, " على "],
  [/−/g, " ناقص "], // U+2212 real minus sign only — plain "-" hyphens are left alone
  [/\+/g, " زائد "],
  [/=/g, " يساوي "],
  [/√/g, " الجذر التربيعي لـ "],
];

function verbalizeMathForSpeech(text: string): string {
  let result = text
    .replace(/\^2\b/g, " تربيع ")
    .replace(/\^3\b/g, " تكعيب ")
    .replace(/\^(\d+)/g, " أُس $1 ")
    .replace(/(\d)\s*\/\s*(\d)/g, "$1 على $2"); // spoken fractions: "3/2" -> "3 على 2"

  for (const [pattern, replacement] of MATH_SPEECH_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// Matches emoji and the invisible modifiers that ride along with them
// (variation selector, zero-width joiner, skin-tone modifiers, keycap
// combiner) so speechSynthesis doesn't read out e.g. "raised eyebrow" for
// something the student only ever sees as 🤔. \p{Extended_Pictographic}
// requires the `u` flag; supported in every modern browser/Node runtime.
const EMOJI_RE = /[\p{Extended_Pictographic}‍️\u{1F3FB}-\u{1F3FF}⃣]/gu;

// Markdown thematic breaks ("---", "___", "***" on their own line) — left
// alone, screen readers/TTS engines read these as a run of "dash" sounds.
const HORIZONTAL_RULE_RE = /^\s*([-_*])\1{2,}\s*$/;

/**
 * Strips markdown noise, emoji, and collapses blank lines/paragraph breaks
 * so TTS doesn't stutter between chunks or read out symbol names, and drops
 * SVG code blocks entirely (they have nothing worth speaking). This never
 * touches the text actually shown in the chat — only the copy handed to
 * speechSynthesis.
 */
export function cleanTextForSpeech(content: string): string {
  return verbalizeMathForSpeech(convertLatexMath(content))
    .replace(SVG_FENCE_RE, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(EMOJI_RE, "")
    .replace(/[*_#>`~$]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !HORIZONTAL_RULE_RE.test(line))
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
