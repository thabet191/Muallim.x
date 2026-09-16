"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

type Status = "loading" | "ready" | "error";

export function BookPageViewer({
  subjectId,
  pageNumber,
  refreshKey,
}: {
  subjectId: string;
  pageNumber: number;
  refreshKey: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Loading pdfjs and the PDF bytes touches the DOM/worker APIs, so it's all
  // done lazily inside an effect (client-only) rather than at module import
  // time — importing pdfjs-dist eagerly at the top of a file that also
  // renders on the server during SSR is a common source of crashes there.
  useEffect(() => {
    let cancelled = false;
    pdfDocRef.current = null;

    (async () => {
      setStatus("loading");
      setErrorMessage(null);
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const response = await fetch(`/api/materials/file?subjectId=${subjectId}`);
        if (!response.ok) {
          throw new Error("لا يوجد ملف PDF أصلي متاح لهذه المادة بعد.");
        }
        const buffer = await response.arrayBuffer();
        if (cancelled) return;

        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        if (cancelled) return;

        pdfDocRef.current = pdf;
        setStatus("ready");
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(error instanceof Error ? error.message : "تعذّر تحميل الكتاب.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [subjectId, refreshKey]);

  useEffect(() => {
    if (status !== "ready" || !pdfDocRef.current || !canvasRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const pdf = pdfDocRef.current;
        if (!pdf) return;
        const clampedPage = Math.min(Math.max(1, pageNumber || 1), pdf.numPages);
        const page = await pdf.getPage(clampedPage);
        if (cancelled) return;

        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;

        // Fit the whole page inside the panel's available height/width
        // rather than rendering at a fixed scale and forcing a scroll.
        const container = containerRef.current;
        const unscaledViewport = page.getViewport({ scale: 1 });
        const availableHeight = (container?.clientHeight || 400) - 16;
        const availableWidth = (container?.clientWidth || 300) - 16;
        const fitScale = Math.min(
          availableHeight / unscaledViewport.height,
          availableWidth / unscaledViewport.width,
        );
        const viewport = page.getViewport({ scale: Math.max(fitScale, 0.3) });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport, canvas }).promise;
      } catch {
        if (!cancelled) setErrorMessage("تعذّر عرض هذه الصفحة.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, pageNumber]);

  if (status === "loading") {
    return (
      <div className="flex h-full min-h-40 items-center justify-center text-sm text-[var(--foreground)]/50">
        جارٍ تحميل صفحة الكتاب...
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-full min-h-40 items-center justify-center px-4 text-center text-sm text-[var(--foreground)]/50">
        {errorMessage}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex h-full items-center justify-center overflow-auto p-2">
      <canvas ref={canvasRef} className="max-w-full rounded shadow" />
    </div>
  );
}
