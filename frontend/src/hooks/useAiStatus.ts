/**
 * useAiStatus — tracks where the AI pipeline currently is.
 *
 *   markSent() called when AI-bound text leaves the client → "thinking"
 *   visualization_command / image_command arrives               → "complete"
 *   error arrives                                               → "error"
 *   safety timeout (12s) or settle timer                        → "idle"
 *
 * The phase drives the header status chip, the composing overlay,
 * and the first-scene AI processing state.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ServerMessage } from "@/types";

export type AiPhase = "idle" | "thinking" | "complete" | "error";

const TIMEOUT_MS = 12_000;
const SETTLE_MS = 2_600;

export function useAiStatus(lastMessage: ServerMessage | null) {
  const [phase, setPhase] = useState<AiPhase>("idle");
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Call whenever a transcript/demo/test message is sent to the server. */
  const markSent = useCallback(() => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    setPhase("thinking");
  }, []);

  // Resolve on server response
  useEffect(() => {
    if (!lastMessage) return;

    if (
      (lastMessage.type === "visualization_command" ||
        lastMessage.type === "image_command") &&
      phase === "thinking"
    ) {
      setPhase("complete");
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => setPhase("idle"), SETTLE_MS);
    } else if (lastMessage.type === "error") {
      setPhase("error");
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => setPhase("idle"), SETTLE_MS * 2);
    }
  }, [lastMessage, phase]);

  // Safety timeout — never spin forever
  useEffect(() => {
    if (phase !== "thinking") return;
    const t = setTimeout(() => setPhase("idle"), TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // Clear settle timer on unmount
  useEffect(() => {
    const timer = settleTimerRef;
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { phase, markSent };
}
