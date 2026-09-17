"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cleanTextForSpeech, splitIntoSpeechChunks } from "@/lib/message-content";

const ARABIC_RE = /[؀-ۿ]/;
const LATIN_LETTER_RE = /[a-zA-Z]/;

/**
 * A chunk is only really "English" if it has actual English letters and no
 * Arabic. Everything else — including a chunk that's just digits and math
 * symbols, like a fraction "(72)/(8)" split out on its own by sentence
 * chunking — defaults to Arabic. Without this, a numbers-only chunk has no
 * Arabic characters either, so the old "Arabic present? ar : en" check
 * picked an English voice for it, making the teacher's voice jump to
 * English for the math and back to Arabic for the explanation around it.
 */
function isEnglish(text: string): boolean {
  return LATIN_LETTER_RE.test(text) && !ARABIC_RE.test(text);
}

export function useTeacherVoice() {
  const [enabled, setEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const queueRef = useRef<string[]>([]);
  const tokenRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  const pickVoice = useCallback((text: string): SpeechSynthesisVoice | undefined => {
    const targetPrefix = isEnglish(text) ? "en" : "ar";
    const voices = voicesRef.current;
    return (
      voices.find((v) => v.lang.toLowerCase().startsWith(targetPrefix) && v.localService) ??
      voices.find((v) => v.lang.toLowerCase().startsWith(targetPrefix))
    );
  }, []);

  const stop = useCallback(() => {
    tokenRef.current += 1; // invalidates any in-flight onend callbacks
    queueRef.current = [];
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (rawText: string) => {
      if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;

      const clean = cleanTextForSpeech(rawText);
      if (!clean) return;

      stop();
      const myToken = tokenRef.current;
      queueRef.current = splitIntoSpeechChunks(clean);
      setSpeaking(true);

      const speakNext = () => {
        if (myToken !== tokenRef.current) return; // superseded by a newer speak()/stop()
        const nextChunk = queueRef.current.shift();
        if (!nextChunk) {
          setSpeaking(false);
          return;
        }

        const utterance = new SpeechSynthesisUtterance(nextChunk);
        const voice = pickVoice(nextChunk);
        utterance.voice = voice ?? null;
        utterance.lang = voice?.lang ?? (isEnglish(nextChunk) ? "en-US" : "ar-SA");
        utterance.rate = 0.9; // slightly slower, clearer for a student
        utterance.pitch = 1;
        utterance.onend = speakNext;
        utterance.onerror = speakNext;
        window.speechSynthesis.speak(utterance);
      };

      // Chrome can drop a speak() called in the same tick as cancel().
      window.setTimeout(speakNext, 30);
    },
    [enabled, pickVoice, stop],
  );

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => {
      if (prev) stop();
      return !prev;
    });
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { enabled, speaking, speak, stop, toggleEnabled };
}
