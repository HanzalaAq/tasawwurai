/**
 * ConceptLab — the concept catalog, organized by discipline.
 *
 * Replaces the old flat "Quick Test" button blob with a curated,
 * subject-grouped catalog. Sends the exact same `test` messages
 * the backend already understands (subject + concept).
 *
 * Includes a search filter so any of the 24 concepts is one
 * keystroke away.
 */

"use client";

import { useMemo, useState } from "react";
import type { ClientMessage } from "@/types";
import { subjectTheme } from "@/lib/subjectTheme";
import { Tooltip } from "@/components/ui/Tooltip";

interface Props {
  onSend: (message: ClientMessage) => void;
  disabled: boolean;
}

interface Concept {
  subject: string;
  concept: string;
  label: string;
}

const CATALOG: Concept[] = [
  // Physics
  { subject: "physics", concept: "projectile_motion", label: "Projectile" },
  { subject: "physics", concept: "wave_motion", label: "Wave" },
  { subject: "physics", concept: "free_fall", label: "Free Fall" },
  { subject: "physics", concept: "pendulum", label: "Pendulum" },
  { subject: "physics", concept: "simple_harmonic_motion", label: "Spring" },
  { subject: "physics", concept: "momentum_collisions", label: "Collision" },
  { subject: "physics", concept: "ray_optics", label: "Lens" },
  // Math
  { subject: "math", concept: "quadratic_function", label: "Quadratic" },
  { subject: "math", concept: "derivative", label: "Derivative" },
  { subject: "math", concept: "vector", label: "Vector" },
  { subject: "math", concept: "unit_circle", label: "Unit Circle" },
  { subject: "math", concept: "integration", label: "Riemann" },
  // Computer Science
  { subject: "computer_science", concept: "sorting_algorithm", label: "Sorting" },
  { subject: "computer_science", concept: "binary_tree", label: "Tree" },
  { subject: "computer_science", concept: "bfs_dfs", label: "BFS/DFS" },
  { subject: "computer_science", concept: "pathfinding", label: "Pathfinding" },
  { subject: "computer_science", concept: "recursion", label: "Hanoi" },
  // Biology
  { subject: "biology", concept: "dna_replication", label: "DNA" },
  { subject: "biology", concept: "cell_structure", label: "Cell" },
  { subject: "biology", concept: "mendelian_genetics", label: "Punnett" },
  { subject: "biology", concept: "enzyme_kinetics", label: "Enzyme" },
  // Chemistry
  { subject: "chemistry", concept: "atomic_structure", label: "Atom" },
  { subject: "chemistry", concept: "molecule", label: "Molecule" },
  { subject: "chemistry", concept: "acid_base_titration", label: "Titration" },
];

export function ConceptLab({ onSend, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>("physics");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATALOG;
    return CATALOG.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.subject.includes(q) ||
        c.concept.includes(q)
    );
  }, [query]);

  const groups = useMemo(() => {
    const map = new Map<string, Concept[]>();
    for (const c of filtered) {
      const list = map.get(c.subject) ?? [];
      list.push(c);
      map.set(c.subject, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // While searching, show all groups expanded
  const effectiveExpanded = query.trim() ? "__all__" : expanded;

  return (
    <section className="rounded-xl border border-steel-200/80 bg-white/70 p-3">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-steel-500">
          Concept Catalog
        </h3>
        <span className="font-mono text-[10px] text-steel-400">{filtered.length}/24</span>
      </header>

      {/* Search */}
      <div className="relative mb-3">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-steel-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search concepts…"
          className="w-full rounded-lg border border-steel-200 bg-white/80 py-1.5 pl-8 pr-3 text-xs text-dusk-700 placeholder:text-steel-400 focus:border-azure-500/50 focus:outline-none focus:ring-1 focus:ring-azure-500/25"
          aria-label="Search concepts"
        />
      </div>

      {/* Groups */}
      <div className="space-y-2">
        {groups.map(([subject, concepts]) => {
          const theme = subjectTheme(subject);
          const isOpen = effectiveExpanded === "__all__" || effectiveExpanded === subject;
          return (
            <div key={subject} className="overflow-hidden rounded-lg border border-steel-200/80">
              <button
                onClick={() => setExpanded((prev) => (prev === subject ? null : subject))}
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-steel-500/5"
                aria-expanded={isOpen}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded font-mono text-[10px] ring-1 ${theme.bg} ${theme.text} ${theme.ring}`}
                >
                  {theme.monogram}
                </span>
                <span className="flex-1 text-xs font-medium text-dusk-700">{theme.label}</span>
                <span className="font-mono text-[10px] text-steel-400">{concepts.length}</span>
                <svg
                  className={`h-3 w-3 text-steel-400 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>

              {isOpen && (
                <div className="flex flex-wrap gap-1.5 border-t border-steel-200/70 p-2.5">
                  {concepts.map((c) => (
                    <Tooltip key={`${c.subject}.${c.concept}`} content={`${c.subject}.${c.concept}`} side="top">
                      <button
                        onClick={() => onSend({ type: "test", subject: c.subject, concept: c.concept })}
                        disabled={disabled}
                        className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all ${theme.bg} ${theme.text} ring-1 ${theme.ring} hover:shadow-sm hover:shadow-steel-500/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        {c.label}
                      </button>
                    </Tooltip>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {groups.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-steel-500">
            No concepts match “{query}”.
          </p>
        )}
      </div>

      {/* Ping */}
      <button
        onClick={() => onSend({ type: "ping", timestamp: Date.now() / 1000 })}
        disabled={disabled}
        className="mt-3 w-full rounded-lg border border-steel-200 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-steel-500 transition-colors hover:border-steel-300 hover:bg-steel-500/10 hover:text-dusk-700 disabled:opacity-40"
      >
        Ping server
      </button>
    </section>
  );
}
