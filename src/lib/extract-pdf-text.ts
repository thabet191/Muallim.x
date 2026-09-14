// Import the implementation directly rather than the package root: the
// package's index.js has a `!module.parent` "debug mode" check left over
// from its test harness that misfires once bundled, trying to read a test
// fixture off disk at import time.
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export const MAX_PDF_BYTES = 40 * 1024 * 1024; // 40MB

export async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const result = await pdfParse(buffer);
  return { text: result.text.trim(), pageCount: result.numpages };
}
