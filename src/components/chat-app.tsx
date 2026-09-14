"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SubjectPanel } from "@/components/subject-panel";
import { ChatThread } from "@/components/chat-thread";
import { ChatComposer } from "@/components/chat-composer";
import { useTeacherVoice } from "@/hooks/use-teacher-voice";
import type { ChatMessage, ProgressSummary, SubjectSummary } from "@/lib/types";

export function ChatApp({ subjects }: { subjects: SubjectSummary[] }) {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
    subjects[0]?.id ?? null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [studentMaterial, setStudentMaterial] = useState<{
    title: string;
    fileName: string | null;
  } | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const voice = useTeacherVoice();
  const kickedOffRef = useRef<Set<string>>(new Set());

  const loadSubjectMeta = useCallback(async (subjectId: string) => {
    const [messagesRes, progressRes] = await Promise.all([
      fetch(`/api/messages?subjectId=${subjectId}`),
      fetch(`/api/progress?subjectId=${subjectId}`),
    ]);
    const messagesData = await messagesRes.json().catch(() => null);
    const progressData = await progressRes.json().catch(() => null);
    setStudentMaterial(messagesData?.studentMaterial ?? null);
    setProgress(progressData ?? null);
    return messagesData;
  }, []);

  const sendToTeacher = useCallback(
    async (subjectId: string, message?: string) => {
      setIsStreaming(true);
      setStreamingText("");
      setError(null);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subjectId, message: message ?? "" }),
        });

        if (!response.ok || !response.body) {
          const text = await response.text().catch(() => "");
          throw new Error(text || "تعذّر الاتصال بالمعلم.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let full = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          setStreamingText(full);
        }

        if (full.trim()) {
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "assistant", content: full },
          ]);
          voice.speak(full);
        }
        void loadSubjectMeta(subjectId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع.");
      } finally {
        setIsStreaming(false);
        setStreamingText("");
      }
    },
    [loadSubjectMeta, voice],
  );

  useEffect(() => {
    if (!selectedSubjectId) return;
    let cancelled = false;

    (async () => {
      const messagesData = await loadSubjectMeta(selectedSubjectId);
      if (cancelled) return;

      setMessages(messagesData?.messages ?? []);

      if (!kickedOffRef.current.has(selectedSubjectId)) {
        kickedOffRef.current.add(selectedSubjectId);
        void sendToTeacher(selectedSubjectId);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubjectId]);

  const handleSend = (message: string) => {
    if (!selectedSubjectId || isStreaming) return;
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: message }]);
    void sendToTeacher(selectedSubjectId, message);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden sm:flex-row-reverse">
      {!fullscreen && (
        <SubjectPanel
          subjects={subjects}
          selectedSubjectId={selectedSubjectId}
          onSelectSubject={setSelectedSubjectId}
          progress={progress}
          studentMaterial={studentMaterial}
          onMaterialChange={() => {
            if (selectedSubjectId) void loadSubjectMeta(selectedSubjectId);
          }}
        />
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={voice.toggleEnabled}
              className={`rounded-lg border px-3 py-1.5 transition ${
                voice.enabled
                  ? "border-[var(--brand)] text-[var(--brand)]"
                  : "border-[var(--border)] text-[var(--foreground)]/50"
              }`}
              title="تشغيل/إيقاف قراءة الردود صوتيًا"
            >
              {voice.speaking ? "🔊 يتحدث..." : voice.enabled ? "🔊 الصوت مفعّل" : "🔇 الصوت متوقف"}
            </button>
          </div>

          <button
            onClick={() => setFullscreen((v) => !v)}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm transition hover:border-[var(--brand)]"
          >
            {fullscreen ? "⤢ تصغير" : "⤢ ملء الشاشة"}
          </button>
        </div>

        {error && (
          <p className="bg-[var(--danger)]/10 px-4 py-2 text-center text-xs text-[var(--danger)]">
            {error}
          </p>
        )}

        <ChatThread messages={messages} streamingText={streamingText} isStreaming={isStreaming} />
        <ChatComposer disabled={isStreaming || !selectedSubjectId} onSend={handleSend} />
      </div>
    </div>
  );
}
