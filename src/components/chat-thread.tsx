"use client";

import { useEffect, useRef } from "react";
import { MessageContent } from "@/components/message-content";
import type { ChatMessage } from "@/lib/types";

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm sm:max-w-[70%] ${
          isUser
            ? "bg-[var(--surface-muted)] text-[var(--foreground)]"
            : "bg-[var(--brand-soft)] text-[var(--foreground)]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function ChatThread({
  messages,
  streamingText,
  isStreaming,
}: {
  messages: ChatMessage[];
  streamingText: string;
  isStreaming: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingText]);

  const showEmptyState = messages.length === 0 && !isStreaming;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {showEmptyState && (
          <p className="text-center text-sm text-[var(--foreground)]/50">
            اختر مادة من القائمة، وسيبدأ المعلم الجلسة معك بنفسه.
          </p>
        )}

        {messages.map((message) => (
          <Bubble key={message.id} role={message.role}>
            <MessageContent content={message.content} />
          </Bubble>
        ))}

        {isStreaming && (
          <Bubble role="assistant">
            {streamingText ? (
              <MessageContent content={streamingText} />
            ) : (
              <span className="inline-flex gap-1 py-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
              </span>
            )}
          </Bubble>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
