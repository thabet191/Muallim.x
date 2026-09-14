"use client";

import { useMemo } from "react";
import { sanitizeSvg } from "@/lib/sanitize-svg";

export function SvgBlock({ raw }: { raw: string }) {
  const clean = useMemo(() => sanitizeSvg(raw), [raw]);

  if (!clean) {
    // Fail closed: never fall back to showing the raw/broken markup.
    return null;
  }

  return (
    <div
      className="my-3 flex justify-center rounded-xl border border-[var(--border)] bg-white p-3"
      // Content passed through sanitizeSvg's strict allowlist above.
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
