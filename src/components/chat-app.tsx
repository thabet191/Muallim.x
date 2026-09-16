"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SubjectPanel } from "@/components/subject-panel";
import { ChatThread } from "@/components/chat-thread";
import { ChatComposer } from "@/components/chat-composer";
import { LessonVisualPanel } from "@/components/lesson-visual-panel";
import { useTeacherVoice } from "@/hooks/use-teacher-voice";
import { findLastSvg } from "@/lib/message-content";
import type { ChatMessage, ProgressSummary, SubjectSummary } from "@/lib/types";

export function ChatApp({ subjects }: { subjects: SubjectSummary[] }) {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
    subjects[0]?.id ?? null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [materialsVersion, setMaterialsVersion] = useState(0);
  // On narrow screens the settings panel and the chat can't both fit on
  // screen at once (the panel's natural content height used to push the
  // composer/buttons off the bottom entirely) — so on mobile exactly one of
  // them shows at a time; on sm+ screens both are always visible regardless.
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);

  const voice = useTeacherVoice();
  const kickedOffRef = useRef<Set<string>>(new Set());
  const streamAbortRef = useRef<AbortController | null>(null);
  const callTokenRef = useRef(0);

  const loadProgress = useCallback(async (subjectId: string) => {
    const progressData = await fetch(`/api/progress?subjectId=${subjectId}`)
      .then((r) => r.json())
      .catch(() => null);
    setProgress(progressData ?? null);
  }, []);

  const sendToTeacher = useCallback(
    async (subjectId: string, message?: string) => {
      // Uniquely identifies this call so its cleanup can tell whether it's
      // still the "current" one by the time it finishes — needed because
      // stopTeacher() below resets isStreaming immediately rather than
      // waiting for this promise to settle, so a slow-to-reject aborted
      // call must never clobber a newer call's in-progress state.
      const myToken = ++callTokenRef.current;
      setIsStreaming(true);
      setStreamingText("");
      setError(null);

      const controller = new AbortController();
      streamAbortRef.current = controller;

      let full = "";
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subjectId, message: message ?? "" }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const text = await response.text().catch(() => "");
          throw new Error(text || "تعذّر الاتصال بالمعلم.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          if (myToken === callTokenRef.current) setStreamingText(full);
        }
      } catch (err) {
        const isAbort = err instanceof DOMException && err.name === "AbortError";
        if (!isAbort && myToken === callTokenRef.current) {
          setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع.");
        }
      } finally {
        if (full.trim()) {
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "assistant", content: full },
          ]);
          voice.speak(full);
        }
        void loadProgress(subjectId);
        // Only the still-current call gets to touch the shared streaming
        // UI state — an aborted/superseded call's cleanup must not stomp
        // on a newer call that's already running.
        if (myToken === callTokenRef.current) {
          setIsStreaming(false);
          setStreamingText("");
          streamAbortRef.current = null;
        }
      }
    },
    [loadProgress, voice],
  );

  const stopTeacher = useCallback(() => {
    // Reset the UI immediately rather than waiting for the aborted fetch's
    // promise to settle — some browsers don't reliably reject a pending
    // stream read on abort, which otherwise left the stop button stuck
    // forever after a single click.
    callTokenRef.current += 1;
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    voice.stop();
    setIsStreaming(false);
    setStreamingText("");
  }, [voice]);

  useEffect(() => {
    if (!selectedSubjectId) return;
    let cancelled = false;

    (async () => {
      const [messagesData] = await Promise.all([
        fetch(`/api/messages?subjectId=${selectedSubjectId}`)
          .then((r) => r.json())
          .catch(() => null),
        loadProgress(selectedSubjectId),
      ]);
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
    voice.stop();
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: message }]);
    void sendToTeacher(selectedSubjectId, message);
  };

  // Lets the student explicitly (re)prompt the teacher to start — needed
  // because the automatic kickoff only ever fires once per subject, so
  // switching to a newly uploaded book afterward would otherwise leave the
  // teacher silently waiting on the old material with no visible way to ask
  // it to move on. If the teacher is still mid-response (e.g. the student
  // taps a book while the opening greeting is still streaming in), silently
  // refusing looked exactly like a broken button — interrupt it instead,
  // the same way the stop button does, and start fresh right away.
  const handleStartLesson = () => {
    if (!selectedSubjectId) return;
    if (isStreaming) stopTeacher();
    setMobileSettingsOpen(false);
    void sendToTeacher(selectedSubjectId);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden sm:flex-row-reverse">
      {!fullscreen && (
        <div className={`${mobileSettingsOpen ? "flex" : "hidden"} sm:flex`}>
          <SubjectPanel
            subjects={subjects}
            selectedSubjectId={selectedSubjectId}
            onSelectSubject={setSelectedSubjectId}
            materialsVersion={materialsVersion}
            onMaterialChange={() => setMaterialsVersion((v) => v + 1)}
            onCloseMobile={() => setMobileSettingsOpen(false)}
            onStartLesson={handleStartLesson}
          />
        </div>
      )}

      <div
        className={`flex-1 flex-col overflow-hidden ${mobileSettingsOpen ? "hidden sm:flex" : "flex"}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            {!fullscreen && (
              <button
                onClick={() => setMobileSettingsOpen(true)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 transition hover:border-[var(--brand)] sm:hidden"
              >
                ⚙ المادة والمكتبة
              </button>
            )}
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

            <button
              onClick={handleStartLesson}
              disabled={!selectedSubjectId}
              title="اطلب من المعلم إعادة بدء الدرس الحالي"
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 transition hover:border-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              🔄 إعادة الدرس
            </button>

            {progress?.currentLocation && (
              <span className="rounded-lg bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-medium text-[var(--brand-dark)]">
                📍 {progress.currentLocation}
              </span>
            )}
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

        {selectedSubjectId && (
          <LessonVisualPanel
            subjectId={selectedSubjectId}
            currentPage={progress?.currentPage ?? null}
            lastSvg={findLastSvg(messages)}
            materialsVersion={materialsVersion}
          />
        )}

        <ChatThread messages={messages} streamingText={streamingText} isStreaming={isStreaming} />
        <ChatComposer
          disabled={!selectedSubjectId}
          isStreaming={isStreaming}
          onSend={handleSend}
          onStop={stopTeacher}
        />
      </div>
    </div>
  );
}
