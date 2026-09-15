"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";

export function ChatComposer({
  disabled,
  isStreaming,
  onSend,
  onStop,
}: {
  disabled: boolean;
  isStreaming: boolean;
  onSend: (message: string) => void;
  onStop: () => void;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isStreaming) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={
            isStreaming
              ? "اضغط إيقاف لمقاطعة المعلم وطرح سؤالك..."
              : "اكتب ردّك هنا..."
          }
          className="max-h-40 flex-1 resize-none rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--brand)] disabled:opacity-60"
        />

        {isStreaming ? (
          <button
            onClick={onStop}
            className="rounded-xl bg-[var(--danger)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            ⏹ إيقاف
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={disabled || !value.trim()}
            className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-dark)] disabled:opacity-40"
          >
            إرسال
          </button>
        )}
      </div>
    </div>
  );
}
