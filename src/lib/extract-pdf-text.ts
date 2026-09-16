// Import the implementation directly rather than the package root: the
// package's index.js has a `!module.parent` "debug mode" check left over
// from its test harness that misfires once bundled, trying to read a test
// fixture off disk at import time.
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export const MAX_PDF_BYTES = 40 * 1024 * 1024; // 40MB

// The chat route only ever uses the first MAX_MATERIAL_CHARS (60,000) of
// this text — extracting far more than that from a long textbook still
// costs real memory and time (pdf.js loads fonts and page resources for
// every page it processes) for text that's thrown away later. Capping
// extraction well above that also bounds the worst case for an oversized
// or malformed file instead of fully parsing every one of its pages.
const MAX_EXTRACTED_CHARS = 400_000;

// pdf.js text-content item, as seen inside pdf-parse's page callback.
type PdfTextItem = { str: string; transform: number[] };
type PdfPageData = {
  pageNumber: number;
  getTextContent: (opts: {
    normalizeWhitespace: boolean;
    disableCombineTextItems: boolean;
  }) => Promise<{ items: PdfTextItem[] }>;
};

export async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  let totalChars = 0;

  /**
   * Renders a page's text with an explicit "[صفحة N]" marker so the
   * extracted material keeps real page boundaries — the teacher can then
   * tell the student which page/chapter it's explaining from.
   */
  async function renderPageWithMarker(pageData: PdfPageData): Promise<string> {
    if (totalChars >= MAX_EXTRACTED_CHARS) return "";

    const textContent = await pageData.getTextContent({
      normalizeWhitespace: false,
      disableCombineTextItems: false,
    });

    let lastY: number | undefined;
    let text = "";
    for (const item of textContent.items) {
      if (lastY === item.transform[5] || lastY === undefined) {
        text += item.str;
      } else {
        text += "\n" + item.str;
      }
      lastY = item.transform[5];
    }

    totalChars += text.length;
    return `[صفحة ${pageData.pageNumber}]\n${text}`;
  }

  const result = await pdfParse(buffer, { pagerender: renderPageWithMarker });
  return { text: result.text.trim(), pageCount: result.numpages };
}
