/**
 * TestPanel — UI for sending test messages to the backend.
 *
 * Lets the user pick a subject/concept and trigger a mock
 * visualization command. Used for development before AI is wired up.
 */

import { useState } from "react";
import type { ClientMessage } from "@/types";

interface Props {
  onSend: (message: ClientMessage) => void;
  disabled: boolean;
}

const TEST_SCENARIOS = [
  { subject: "physics", concept: "projectile_motion", label: "Projectile Motion" },
  { subject: "physics", concept: "wave_motion", label: "Wave Motion" },
  { subject: "math", concept: "quadratic_function", label: "Quadratic Function" },
];

export function TestPanel({ onSend, disabled }: Props) {
  const [selected, setSelected] = useState(0);

  const handleTest = () => {
    const scenario = TEST_SCENARIOS[selected];
    onSend({ type: "test", subject: scenario.subject, concept: scenario.concept });
  };

  const handlePing = () => {
    onSend({ type: "ping", timestamp: Date.now() / 1000 });
  };

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
        Test Controls
      </h3>

      {/* Scenario selector */}
      <div className="mb-3 space-y-1.5">
        {TEST_SCENARIOS.map((s, i) => (
          <button
            key={`${s.subject}.${s.concept}`}
            onClick={() => setSelected(i)}
            className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              i === selected
                ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40"
                : "bg-gray-700/30 text-gray-400 hover:bg-gray-700/50"
            }`}
          >
            {s.label}
            <span className="ml-2 text-xs text-gray-500">
              {s.subject}.{s.concept}
            </span>
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleTest}
          disabled={disabled}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send Test Command
        </button>
        <button
          onClick={handlePing}
          disabled={disabled}
          className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Ping
        </button>
      </div>
    </div>
  );
}
