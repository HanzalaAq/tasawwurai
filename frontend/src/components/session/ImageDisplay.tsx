/**
 * ImageDisplay — renders AI-generated educational images with enhanced UX.
 *
 * Features:
 *   - Click-to-zoom fullscreen overlay
 *   - Retry button on load failure
 *   - Staged loading progress (Connecting → Generating → Finalizing)
 *   - Smooth crossfade between images
 *   - Expandable caption with prompt text
 *   - Download and open-in-new-tab buttons
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageCommandMessage } from "@/types";

interface Props {
  command: ImageCommandMessage;
}

type LoadingStage = "connecting" | "generating" | "finalizing" | "done";

const STAGE_LABELS: Record<LoadingStage, string> = {
  connecting: "Connecting to image service…",
  generating: "Generating illustration…",
  finalizing: "Finalizing…",
  done: "",
};

export function ImageDisplay({ command }: Props) {
  const [stage, setStage] = useState<LoadingStage>("connecting");
  const [hasError, setHasError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const stageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when a new image command arrives
  useEffect(() => {
    setStage("connecting");
    setHasError(false);
    setIsZoomed(false);

    // Advance loading stages automatically for visual feedback
    stageTimerRef.current = setTimeout(() => {
      setStage((s) => (s === "connecting" ? "generating" : s));
    }, 800);

    return () => {
      if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
    };
  }, [command.image_url, retryKey]);

  const handleLoad = useCallback(() => {
    setStage("finalizing");
    // Brief finalizing stage for smooth feel
    setTimeout(() => setStage("done"), 300);
  }, []);

  const handleError = useCallback(() => {
    setStage("done");
    setHasError(true);
  }, []);

  const handleRetry = useCallback(() => {
    setRetryKey((k) => k + 1);
  }, []);

  const isLoading = stage !== "done";
  const isLoadingDone = stage === "done" && !hasError;

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-gray-700/50 px-5 py-2.5">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-semibold text-emerald-300">
            AI Image
          </span>
          <span className="text-xs text-gray-500">
            {command.subject} / {command.concept}
          </span>
        </div>
        {isLoadingDone && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => window.open(command.image_url, "_blank")}
              className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-700/40 hover:text-gray-300"
              title="Open in new tab"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </button>
            <button
              onClick={() => setIsZoomed(true)}
              className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-700/40 hover:text-gray-300"
              title="View fullscreen"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Image area */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-gray-900/40 p-4">
        {/* Loading overlay with staged progress */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-gray-900/80">
            {/* Animated spinner */}
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-700 border-t-emerald-500" />
              <div className="absolute inset-2 animate-spin rounded-full border-4 border-gray-700 border-t-blue-500" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-300">{STAGE_LABELS[stage]}</p>
              <p className="mt-1 text-xs text-gray-600">This may take 5–15 seconds</p>
            </div>
            {/* Progress bar */}
            <div className="h-1 w-48 overflow-hidden rounded-full bg-gray-700">
              <div
                className="image-progress-bar h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500"
                style={{ animationDuration: stage === "connecting" ? "3s" : "12s" }}
              />
            </div>
          </div>
        )}

        {/* Error state */}
        {hasError && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 border border-red-500/20">
              <svg className="h-7 w-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-red-300">Failed to generate image</p>
              <p className="mt-1 max-w-xs text-xs text-gray-500">
                The image service may be temporarily unavailable.
              </p>
            </div>
            <button
              onClick={handleRetry}
              className="mt-1 flex items-center gap-2 rounded-lg bg-gray-700/50 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-600/50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
              </svg>
              Retry
            </button>
          </div>
        )}

        {/* Image */}
        {!hasError && (
          <img
            key={`${command.image_url}-${retryKey}`}
            src={command.image_url}
            alt={command.prompt}
            className={`max-h-full max-w-full cursor-zoom-in rounded-lg object-contain transition-all duration-700 ${
              isLoading ? "scale-95 opacity-0" : "scale-100 opacity-100"
            }`}
            onClick={() => setIsZoomed(true)}
            onLoad={handleLoad}
            onError={handleError}
          />
        )}
      </div>

      {/* Caption bar */}
      <div className="border-t border-gray-700/30 px-5 py-2.5">
        <button
          onClick={() => setCaptionExpanded(!captionExpanded)}
          className="w-full text-left"
        >
          <div className="flex items-center gap-2">
            <svg
              className={`h-3 w-3 shrink-0 text-gray-600 transition-transform ${captionExpanded ? "rotate-90" : ""}`}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
            </svg>
            <p className={`text-xs text-gray-500 ${captionExpanded ? "" : "line-clamp-1"}`}>
              {command.prompt}
            </p>
          </div>
        </button>
      </div>

      {/* Fullscreen zoom overlay */}
      {isZoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsZoomed(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setIsZoomed(false)}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Zoomed image */}
          <img
            src={command.image_url}
            alt={command.prompt}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Prompt overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-16">
            <p className="mx-auto max-w-2xl text-center text-sm text-white/80">
              {command.prompt}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
