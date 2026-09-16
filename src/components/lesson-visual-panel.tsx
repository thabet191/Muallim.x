"use client";

import { useState } from "react";
import { BookPageViewer } from "@/components/book-page-viewer";
import { SvgBlock } from "@/components/svg-block";

type Tab = "page" | "diagram";

export function LessonVisualPanel({
  subjectId,
  currentPage,
  lastSvg,
  materialsVersion,
}: {
  subjectId: string;
  currentPage: number | null;
  lastSvg: string | null;
  materialsVersion: number;
}) {
  const [tab, setTab] = useState<Tab>(lastSvg ? "diagram" : "page");
  const [seenSvg, setSeenSvg] = useState(lastSvg);

  // Jump to the diagram tab whenever a fresh one arrives — that's what the
  // teacher just drew for this exact explanation — but otherwise leave the
  // student's manual tab choice alone. Adjusting state during render (the
  // React-recommended pattern) instead of an effect, since this only needs
  // to run when `lastSvg` itself changes, not after every commit.
  if (lastSvg !== seenSvg) {
    setSeenSvg(lastSvg);
    if (lastSvg) setTab("diagram");
  }

  if (!currentPage && !lastSvg) return null;

  return (
    <div className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-1.5">
        <button
          onClick={() => setTab("page")}
          disabled={!currentPage}
          className={`rounded-lg px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
            tab === "page"
              ? "bg-[var(--brand)] text-white"
              : "text-[var(--foreground)]/60 hover:bg-[var(--surface-muted)]"
          }`}
        >
          📄 صفحة الكتاب
        </button>
        <button
          onClick={() => setTab("diagram")}
          disabled={!lastSvg}
          className={`rounded-lg px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
            tab === "diagram"
              ? "bg-[var(--brand)] text-white"
              : "text-[var(--foreground)]/60 hover:bg-[var(--surface-muted)]"
          }`}
        >
          🖍 الرسم التوضيحي
        </button>
      </div>

      <div className="h-56 sm:h-72">
        {tab === "page" && currentPage ? (
          <BookPageViewer subjectId={subjectId} pageNumber={currentPage} refreshKey={materialsVersion} />
        ) : tab === "diagram" && lastSvg ? (
          <div className="flex h-full items-center justify-center overflow-auto p-2">
            <SvgBlock raw={lastSvg} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
