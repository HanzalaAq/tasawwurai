/**
 * Demo Mode — simulates teacher speech for product demonstrations.
 *
 * Sends a predefined sequence of teacher statements to the backend
 * as if they came from speech-to-text. Used for demos without
 * requiring a microphone or paid AI API.
 *
 * Organized by topic: each topic is a short, coherent mini-lesson.
 * Every statement contains the trigger keywords for its visualization
 * plus spoken parameter changes ("at 45 degrees", "spring constant
 * of 150") that the backend extracts into live visualization updates.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage } from "@/types";

interface Props {
  onSend: (message: ClientMessage) => void;
  disabled: boolean;
}

interface DemoTopic {
  id: string;
  label: string;
  statements: string[];
}

// Predefined demo topics — each tells a coherent story with spoken
// parameter changes the backend turns into visualization updates.
const DEMO_TOPICS: DemoTopic[] = [
  {
    id: "projectile",
    label: "Projectile Motion",
    statements: [
      "Today we're going to learn about projectile motion. Imagine throwing a ball at an angle.",
      "Let's launch the ball at 20 meters per second at an angle of 45 degrees.",
      "Notice how the trajectory forms a perfect parabola. The horizontal velocity stays constant.",
      "Now let's increase the launch velocity to 40 meters per second.",
      "What happens if we throw at an angle of 60 degrees? Notice the higher arc.",
      "Now throw at an angle of 30 degrees — same range as 60! Complementary angles give equal range.",
      "What if we launch the projectile on the Moon, where gravity pulls only a sixth as hard?",
      "The projectile goes much higher and farther. Reset to Earth gravity at 9.81.",
      "That's projectile motion — the interplay of velocity, angle, and gravity.",
    ],
  },
  {
    id: "spring",
    label: "Spring & SHM",
    statements: [
      "Now for simple harmonic motion — a mass hanging on a spring follows Hooke's law.",
      "Start with a spring constant of 50 and a mass of 2 kilograms.",
      "Let's stiffen the spring — use a spring constant of 150 and watch the mass bounce much faster.",
      "Now give the spring a mass of 8 kilograms — each cycle takes longer, since the period grows with mass.",
      "Pull the mass down to an amplitude of 1.2 — in simple harmonic motion the period never changes.",
      "Damping on the spring slowly drains the energy until the mass settles at equilibrium.",
    ],
  },
  {
    id: "collision",
    label: "Momentum Lab",
    statements: [
      "Let's move to momentum. In a collision between two balls, total momentum is conserved.",
      "Watch the impact — the red ball strikes at 4 meters per second, and the heavier ball barely moves.",
      "Make it elastic — restitution of one means kinetic energy is conserved too.",
      "Now try a perfectly inelastic collision — the two balls stick together and lose the most energy.",
      "Change the mass of ball A to 5 kilograms and watch the momentum transfer.",
    ],
  },
  {
    id: "lens",
    label: "Ray Optics",
    statements: [
      "Now for optics. A converging lens focuses parallel rays to a single focal point.",
      "Use a focal length of 15 centimeters with the object at 40 centimeters.",
      "Now place the object at 10 centimeters — inside the focal length — and the image turns virtual, upright, and magnified.",
      "Try a diverging lens instead — the image is always virtual, upright, and smaller.",
      "A magnifying glass is exactly this case — a converging lens with the object inside its focal length.",
    ],
  },
  {
    id: "unit_circle",
    label: "Unit Circle",
    statements: [
      "Let's visit the unit circle — the angle sweeps around, and the coordinates tell us everything about trig.",
      "On the unit circle, sine is the y-coordinate as the angle sweeps — watch the wave draw itself.",
      "Now trace tangent on the unit circle — see how it blows up near 90 degrees.",
      "Restart the unit circle sweep at 45 degrees — the pattern repeats with every full turn.",
    ],
  },
  {
    id: "riemann",
    label: "Riemann Sums",
    statements: [
      "Now integration. We approximate the area under the curve with rectangles — that's a Riemann sum.",
      "Let's approximate the area under x squared with a riemann sum of 8 rectangles — the estimate runs low.",
      "Now switch the riemann sum to the midpoint rule with 50 rectangles — much closer to the exact integral.",
      "As the rectangle count grows without bound, the riemann sum becomes the definite integral — the fundamental theorem of calculus.",
    ],
  },
  {
    id: "pathfinding",
    label: "Pathfinding",
    statements: [
      "Moving to computer science — pathfinding through a maze, one weighted step at a time.",
      "Dijkstra expands uniformly outward in all directions — guaranteed to find the optimal route.",
      "A star steers toward the goal using a heuristic — far fewer cells explored for the same optimal path.",
      "Greedy best-first trusts the heuristic alone — faster, but not always the best route.",
      "Dial up the wall density and watch how each pathfinding strategy copes — some mazes barely stay solvable.",
    ],
  },
  {
    id: "hanoi",
    label: "Tower of Hanoi",
    statements: [
      "The Tower of Hanoi is the classic recursion puzzle — move the whole stack, one disk at a time.",
      "Solve it with 4 disks — the recursive recipe moves n minus 1 aside, shifts the biggest, then restacks.",
      "Watch the call stack unwind — every extra disk doubles the moves: 2 to the n, minus 1.",
      "Grow the tower of hanoi to 6 disks and the move count explodes past sixty.",
    ],
  },
  {
    id: "punnett",
    label: "Punnett Genetics",
    statements: [
      "Back to biology — Mendel's punnett square predicts how traits pass to offspring.",
      "Cross two heterozygous parents — each square is one equally likely offspring.",
      "The result: a three to one phenotype ratio, with the dominant trait masking the recessive allele.",
      "Now try homozygous dominant crossed with homozygous recessive — every offspring is heterozygous.",
    ],
  },
  {
    id: "enzyme",
    label: "Enzyme Kinetics",
    statements: [
      "Into biochemistry — enzyme kinetics follows the michaelis menten equation.",
      "At low substrate the rate climbs steeply, then flattens near vmax as every active site gets busy.",
      "Now study the enzyme at substrate concentration of 60 — saturation is near.",
      "Add a competitive inhibitor — vmax stays the same but the apparent km rises.",
    ],
  },
  {
    id: "titration",
    label: "Titration",
    statements: [
      "Finally, chemistry — an acid base titration, adding base to acid drop by drop.",
      "For a strong acid the pH climbs steadily to the equivalence point, then levels off.",
      "Switch to a weak acid and notice the buffer region — the flat stretch that resists pH change.",
      "The equivalence point for a weak acid sits above pH 7 — the conjugate base tips it basic.",
    ],
  },
];

export function DemoMode({ onSend, disabled }: Props) {
  const [topicId, setTopicId] = useState(DEMO_TOPICS[0].id);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topic = DEMO_TOPICS.find((t) => t.id === topicId) ?? DEMO_TOPICS[0];
  const statements = topic.statements;

  // Clear any pending auto-advance timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const sendStep = useCallback(
    (index: number) => {
      if (index >= statements.length) {
        setIsPlaying(false);
        setCurrentIndex(0);
        return;
      }

      onSend({
        type: "demo_text",
        text: statements[index],
      } as any);

      setCurrentIndex(index + 1);

      // Auto-advance after delay (simulate teacher pausing)
      timerRef.current = setTimeout(() => {
        sendStep(index + 1);
      }, 4000);
    },
    [onSend, statements]
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

  const handleTopicChange = (id: string) => {
    handlePause();
    setTopicId(id);
    setCurrentIndex(0);
  };

  const handleStep = () => {
    if (currentIndex < statements.length) {
      onSend({
        type: "demo_text",
        text: statements[currentIndex],
      } as any);
      setCurrentIndex((i) => i + 1);
    }
  };

  return (
    <section className="rounded-xl border border-steel-200/80 bg-white/70 p-3.5">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-steel-500">
          Guided Demo
        </h3>
        {/* Progress ring */}
        <span className="relative flex h-6 w-6 items-center justify-center">
          <svg viewBox="0 0 24 24" className="h-6 w-6 -rotate-90">
            <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(106,137,167,0.2)" strokeWidth="2.5" />
            <circle
              cx="12" cy="12" r="9" fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-azure-600 transition-all duration-500"
              strokeDasharray={`${2 * Math.PI * 9}`}
              strokeDashoffset={`${2 * Math.PI * 9 * (1 - currentIndex / statements.length)}`}
            />
          </svg>
          <span className="absolute font-mono text-[8px] text-steel-500">
            {currentIndex}/{statements.length}
          </span>
        </span>
      </header>

      {/* Topic selector */}
      <select
        value={topicId}
        onChange={(e) => handleTopicChange(e.target.value)}
        disabled={disabled}
        className="mb-3 w-full cursor-pointer rounded-lg border border-steel-200 bg-white px-2.5 py-1.5 text-xs text-dusk-700 transition-colors focus:border-azure-500/50 focus:outline-none focus:ring-1 focus:ring-azure-500/25 disabled:opacity-40"
      >
        {DEMO_TOPICS.map((t) => (
          <option key={t.id} value={t.id} className="bg-white">
            {t.label}
          </option>
        ))}
      </select>

      {/* Current/next statement preview */}
      <div className="mb-3 min-h-[60px] rounded-lg border border-steel-200/80 bg-mist-200/70 p-3">
        <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-steel-400">
          {currentIndex < statements.length ? "Next statement" : "Demo complete"}
        </p>
        {currentIndex < statements.length && (
          <p className="text-xs italic leading-relaxed text-steel-600">
            &ldquo;{statements[currentIndex]}&rdquo;
          </p>
        )}
        {currentIndex >= statements.length && (
          <p className="text-xs text-emerald-700/80">Lesson finished — pick another topic.</p>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {!isPlaying ? (
          <button
            onClick={handlePlay}
            disabled={disabled || currentIndex >= statements.length}
            className="flex-1 rounded-lg bg-gradient-to-r from-azure-700 to-azure-800 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-azure-700/25 transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {currentIndex === 0 ? "Start Demo" : "Resume"}
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="flex-1 rounded-lg border border-steel-300 bg-white px-3 py-2 text-xs font-semibold text-dusk-700 transition-all hover:bg-mist-200 active:scale-[0.98]"
          >
            Pause
          </button>
        )}
        <button
          onClick={handleStep}
          disabled={disabled || isPlaying || currentIndex >= statements.length}
          className="rounded-lg border border-steel-300 px-3 py-2 text-xs font-medium text-steel-600 transition-all hover:bg-steel-100 hover:text-dusk-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Step
        </button>
        <button
          onClick={handleReset}
          className="rounded-lg border border-steel-300 px-3 py-2 text-xs font-medium text-steel-600 transition-all hover:bg-steel-100 hover:text-dusk-700 active:scale-[0.98]"
        >
          Reset
        </button>
      </div>
    </section>
  );
}
