/**
 * Demo Mode — simulates teacher speech for product demonstrations.
 *
 * Sends a predefined sequence of teacher statements to the backend
 * as if they came from speech-to-text. Used for demos without
 * requiring a microphone or paid AI API.
 */

"use client";

import { useCallback, useRef, useState } from "react";
import type { ClientMessage } from "@/types";

interface Props {
  onSend: (message: ClientMessage) => void;
  disabled: boolean;
}

// Predefined demo sequence — tells a coherent story about projectile motion
const DEMO_SEQUENCE = [
  "Today we're going to learn about projectile motion. Imagine throwing a ball at an angle.",
  "Let's launch the ball at 20 meters per second at an angle of 45 degrees.",
  "Notice how the trajectory forms a perfect parabola. The horizontal velocity stays constant.",
  "Now let's increase the velocity to 40 meters per second.",
  "What happens if we change the angle to 60 degrees? Notice the higher arc.",
  "Now try 30 degrees. Same range as 60 degrees — complementary angles give equal range!",
  "What if gravity were weaker, like on the Moon at 1.6 meters per second squared?",
  "The ball goes much higher and farther. Let's reset to Earth gravity at 9.81.",
  "That's projectile motion — the interplay of velocity, angle, and gravity.",
];

export function DemoMode({ onSend, disabled }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendStep = useCallback(
    (index: number) => {
      if (index >= DEMO_SEQUENCE.length) {
        setIsPlaying(false);
        setCurrentIndex(0);
        return;
      }

      onSend({
        type: "demo_text",
        text: DEMO_SEQUENCE[index],
      } as any);

      setCurrentIndex(index + 1);

      // Auto-advance after delay (simulate teacher pausing)
      timerRef.current = setTimeout(() => {
        sendStep(index + 1);
      }, 4000);
    },
    [onSend]
  );

  const handlePlay = () => {
    if (isPlaying) return;
    setIsPlaying(true);
    sendStep(currentIndex);
  };

  const handlePause = () => {
    setIsPlaying(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleReset = () => {
    handlePause();
    setCurrentIndex(0);
  };

  const handleStep = () => {
    if (currentIndex < DEMO_SEQUENCE.length) {
      onSend({
        type: "demo_text",
        text: DEMO_SEQUENCE[currentIndex],
      } as any);
      setCurrentIndex((i) => i + 1);
    }
  };

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Demo Mode</h3>
        <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300">
          {currentIndex}/{DEMO_SEQUENCE.length}
        </span>
      </div>

      {/* Current/next statement preview */}
      <div className="mb-3 rounded-lg bg-gray-900/60 p-3 min-h-[60px]">
        <p className="text-xs text-gray-500 mb-1">
          {currentIndex < DEMO_SEQUENCE.length ? "Next statement:" : "Demo complete!"}
        </p>
        {currentIndex < DEMO_SEQUENCE.length && (
          <p className="text-sm text-gray-300 italic">
            &ldquo;{DEMO_SEQUENCE[currentIndex]}&rdquo;
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {!isPlaying ? (
          <button
            onClick={handlePlay}
            disabled={disabled || currentIndex >= DEMO_SEQUENCE.length}
            className="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-500 disabled:opacity-40"
          >
            {currentIndex === 0 ? "Start Demo" : "Resume"}
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="flex-1 rounded-lg bg-gray-600 px-3 py-2 text-xs font-medium text-white hover:bg-gray-500"
          >
            Pause
          </button>
        )}
        <button
          onClick={handleStep}
          disabled={disabled || isPlaying || currentIndex >= DEMO_SEQUENCE.length}
          className="rounded-lg border border-gray-600 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-40"
        >
          Step
        </button>
        <button
          onClick={handleReset}
          className="rounded-lg border border-gray-600 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-gray-700"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
