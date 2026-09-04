"use client";

/**
 * VoiceInput — centralized floating voice control bar.
 *
 * A prominent bottom-center floating bar with:
 *   - Large animated mic button (pulse rings while active)
 *   - Waveform visualizer bars flanking the mic
 *   - Live interim transcript text above the button
 *   - Recording timer and status indicators
 *   - Smooth expand/collapse transitions
 *
 * This is the single source of truth for speech recognition in the session.
 * Uses the Web Speech API via useSpeechRecognition hook.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeechRecognition, type SpeechError } from "@/hooks/useSpeechRecognition";
import type { ClientMessage } from "@/types";

interface Props {
  onSend: (message: ClientMessage) => void;
  disabled: boolean;
  /** Called whenever a final transcript is produced */
  onFinalTranscript?: (text: string) => void;
}

const ERROR_MESSAGES: Record<SpeechError, string> = {
  "not-allowed": "Microphone blocked — click the lock icon in the address bar.",
  "audio-capture": "No microphone found.",
  "network": "Network error — Web Speech API needs internet.",
  "service-not-allowed": "Speech recognition unavailable.",
  "no-speech": "No speech detected.",
  "aborted": "",
  "unknown": "Unexpected error.",
};

export function VoiceInput({ onSend, disabled, onFinalTranscript }: Props) {
  const {
    start,
    stop,
    isListening,
    interimTranscript,
    finalTranscript,
    isSupported,
    error,
  } = useSpeechRecognition();

  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;
  const onFinalRef = useRef(onFinalTranscript);
  onFinalRef.current = onFinalTranscript;

  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Send final transcript to backend + notify parent
  useEffect(() => {
    if (finalTranscript) {
      onSendRef.current({ type: "transcript", text: finalTranscript });
      onFinalRef.current?.(finalTranscript);

      setIsProcessing(true);
      const t = setTimeout(() => setIsProcessing(false), 1500);
      return () => clearTimeout(t);
    }
  }, [finalTranscript]);

  // Elapsed timer while listening
  useEffect(() => {
    if (isListening) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isListening]);

  const formatElapsed = useCallback((s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }, []);

  if (!isSupported) {
    return (
      <div className="voice-input-bar">
        <div className="glass-panel flex items-center gap-3 rounded-2xl px-5 py-3">
          <svg className="h-5 w-5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <p className="text-sm text-amber-700/90">
            Voice input requires Chrome or Edge.
          </p>
        </div>
      </div>
    );
  }

  const errorMsg = error ? ERROR_MESSAGES[error] : null;

  return (
    <div className="voice-input-bar">
      {/* Error toast — floats above the main bar */}
      {errorMsg && (
        <div className="animate-fade-in glass-panel mb-2 flex items-center gap-2 rounded-xl border-rose-500/25 px-4 py-2 shadow-[0_12px_32px_-12px_rgba(225,29,72,0.35)]">
          <svg className="h-4 w-4 shrink-0 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <p className="text-xs text-rose-700">{errorMsg}</p>
        </div>
      )}

      {/* Main floating bar */}
      <div
        className={`voice-input-container glass-panel flex items-center gap-4 rounded-full px-2 py-2 transition-all duration-500 ${
          isListening ? "border-rose-500/30 voice-input-active" : ""
        }`}
      >
        {/* Left: Waveform + interim text */}
        <div className="flex min-w-0 flex-1 items-center justify-end px-3">
          {isListening && interimTranscript ? (
            <p className="voice-input-interim truncate text-sm text-azure-800">
              {interimTranscript}
              <span className="interim-cursor ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-azure-600" />
            </p>
          ) : isListening ? (
            <div className="flex h-8 items-center gap-[3px]">
              {Array.from({ length: 20 }).map((_, i) => (
                <span
                  key={i}
                  className="waveform-bar inline-block w-[2.5px] rounded-full bg-azure-500/70"
                  style={{ animationDelay: `${i * 55}ms`, height: "3px" }}
                />
              ))}
            </div>
          ) : (
            <span className="text-sm text-steel-500">
              {disabled ? "Connecting\u2026" : "Tap mic and speak"}
            </span>
          )}
        </div>

        {/* Center: Mic button */}
        <button
          onClick={isListening ? stop : start}
          disabled={disabled}
          className={`voice-mic-button relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-all duration-300 focus:outline-none ${
            isListening
              ? "bg-gradient-to-br from-rose-500 to-red-600 shadow-lg shadow-rose-500/40 hover:brightness-110 scale-110"
              : "bg-gradient-to-br from-azure-600 to-steel-600 shadow-lg shadow-azure-600/30 hover:brightness-110 hover:scale-105"
          } disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:scale-100`}
          title={isListening ? "Stop listening" : "Start listening"}
          aria-label={isListening ? "Stop listening" : "Start listening"}
        >
          {/* Outer pulse rings when active */}
          {isListening && (
            <>
              <span className="mic-ping absolute inset-0 rounded-full bg-rose-400/30" />
              <span className="mic-ripple absolute inset-[-4px] rounded-full border-2 border-rose-400/40" />
              <span
                className="mic-ripple absolute inset-[-8px] rounded-full border border-rose-400/20"
                style={{ animationDelay: "400ms" }}
              />
            </>
          )}

          {/* Icon */}
          {isListening ? (
            <svg className="h-5 w-5 text-white relative z-10" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg className="h-6 w-6 text-white relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
            </svg>
          )}
        </button>

        {/* Right: Status / timer */}
        <div className="flex min-w-0 flex-1 items-center px-3">
          {isListening ? (
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-500" />
              <span className="font-mono text-sm tabular-nums text-rose-700">
                {formatElapsed(elapsed)}
              </span>
            </div>
          ) : isProcessing ? (
            <div className="flex items-center gap-1.5">
              <span className="processing-dot h-1.5 w-1.5 rounded-full bg-azure-600" />
              <span className="processing-dot h-1.5 w-1.5 rounded-full bg-azure-600" style={{ animationDelay: "150ms" }} />
              <span className="processing-dot h-1.5 w-1.5 rounded-full bg-azure-600" style={{ animationDelay: "300ms" }} />
              <span className="ml-1 text-xs text-azure-700">Analyzing</span>
            </div>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-widest text-steel-400">
              {isSupported ? "voice ready" : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
