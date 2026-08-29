"use client";

/**
 * Hook wrapping the Browser Web Speech API (SpeechRecognition).
 *
 * Provides real-time speech-to-text with interim (partial) and final results.
 * Free — no API key needed. Works in Chrome and Edge.
 *
 * Returns:
 *   - start() / stop() / reset()
 *   - isListening: whether recognition is active
 *   - interimTranscript: partial text being spoken right now
 *   - finalTranscript: the latest completed sentence (fires once per utterance)
 *   - isSupported: whether the browser supports SpeechRecognition
 */

import { useCallback, useEffect, useRef, useState } from "react";

// Extend Window for webkit prefix
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export type SpeechError =
  | "not-allowed"     // mic permission denied
  | "no-speech"       // silence timeout
  | "network"         // network error (Chrome sends audio to Google)
  | "service-not-allowed"
  | "audio-capture"   // no mic found
  | "aborted"
  | "unknown";

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<SpeechError | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldRestartRef = useRef(false);

  // Check support on mount
  useEffect(() => {
    setIsSupported(getSpeechRecognition() !== null);
  }, []);

  const start = useCallback(async () => {
    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) return;

    // Clear previous error
    setError(null);

    // Stop any previous instance
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
    }

    // Request microphone permission explicitly before starting SpeechRecognition.
    // This prevents the browser from silently blocking the request.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release the stream immediately — we just needed the permission grant
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      console.warn("[SpeechRecognition] Microphone permission denied:", err);
      setError("not-allowed");
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    shouldRestartRef.current = true;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      setInterimTranscript("");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }

      setInterimTranscript(interim);

      if (finalText) {
        setFinalTranscript(finalText.trim());
        setInterimTranscript("");
      }
    };

    recognition.onerror = (event) => {
      const err = event.error as SpeechError;
      // "no-speech" and "aborted" are expected — not real errors
      if (err === "no-speech" || err === "aborted") {
        return;
      }
      console.warn("[SpeechRecognition] Error:", err);
      setError(err);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");

      // Auto-restart on silence timeout (Chrome stops after ~5s of silence)
      if (shouldRestartRef.current) {
        try {
          recognition.start();
        } catch {
          // If restart fails, just stop
          shouldRestartRef.current = false;
        }
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.warn("[SpeechRecognition] Failed to start:", err);
      setError("unknown");
    }
  }, []);

  const stop = useCallback(() => {
    shouldRestartRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    setInterimTranscript("");
    setFinalTranscript("");
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    start,
    stop,
    reset,
    isListening,
    interimTranscript,
    finalTranscript,
    isSupported,
    error,
  };
}
