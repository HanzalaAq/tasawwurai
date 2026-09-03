/**
 * Punnett Square Renderer — monohybrid cross genetics.
 *
 * HTML/CSS grid (no canvas) with parameterized parent genotypes.
 *
 * Features:
 * - 2×2 Punnett square with gamete headers
 * - Genotype color coding (homozygous dominant / heterozygous / homozygous recessive)
 * - Genotype and phenotype ratios with count bars
 * - Parent genotype presets and editable trait names
 */

"use client";

import type { RendererProps } from "@/engine/types";

interface PunnettParams {
  parent1: string;
  parent2: string;
  traitDominant: string;
  traitRecessive: string;
}

type GenotypeClass = "homozygous-dominant" | "heterozygous" | "homozygous-recessive";

function sanitizeGenotype(raw: string | undefined): string {
  const letters = (raw ?? "").replace(/[^A-Za-z]/g, "").split("");
  if (letters.length === 0) return "Aa";
  const first = letters[0].toUpperCase();
  const second = (letters[1] ?? first).toUpperCase();
  const both = first + second;
  if (both === "AA") return "AA";
  if (both === "aa") return "aa";
  return "Aa";
}

function classify(genotype: string): GenotypeClass {
  const first = genotype[0];
  const second = genotype[1];
  if (first === second) {
    return first === first.toUpperCase() ? "homozygous-dominant" : "homozygous-recessive";
  }
  return "heterozygous";
}

const GENOTYPE_STYLES: Record<GenotypeClass, { bg: string; border: string; text: string; label: string }> = {
  "homozygous-dominant": { bg: "bg-emerald-900/30", border: "border-emerald-600/40", text: "text-emerald-300", label: "Homozygous dominant" },
  heterozygous: { bg: "bg-blue-900/30", border: "border-blue-600/40", text: "text-blue-300", label: "Heterozygous (carrier)" },
  "homozygous-recessive": { bg: "bg-yellow-900/25", border: "border-yellow-600/40", text: "text-yellow-300", label: "Homozygous recessive" },
};

export default function PunnettRenderer({
  parameters,
  onUpdate,
}: RendererProps<PunnettParams>) {
  const parent1 = sanitizeGenotype(parameters.parent1 as string | undefined);
  const parent2 = sanitizeGenotype(parameters.parent2 as string | undefined);
  const traitDominant = (parameters.traitDominant as string) || "Dominant trait";
  const traitRecessive = (parameters.traitRecessive as string) || "Recessive trait";

  const gametes1 = parent1.split(""); // columns
  const gametes2 = parent2.split(""); // rows

  // Offspring[i][j] = gametes2[i] × gametes1[j], dominant (uppercase) letter first
  const offspring = gametes2.map((g2) =>
    gametes1.map((g1) => {
      const isUpper1 = g1 === g1.toUpperCase();
      const isUpper2 = g2 === g2.toUpperCase();
      const up = (isUpper1 ? g1 : g2).toUpperCase();
      const low = up.toLowerCase();
      if (isUpper1 && isUpper2) return up + up; // homozygous dominant
      if (!isUpper1 && !isUpper2) return low + low; // homozygous recessive
      return up + low; // heterozygous
    })
  );

  const flat = offspring.flat();
  const counts = { dominant: 0, heterozygous: 0, recessive: 0 };
  flat.forEach((g) => {
    const cls = classify(g);
    if (cls === "homozygous-dominant") counts.dominant++;
    else if (cls === "homozygous-recessive") counts.recessive++;
    else counts.heterozygous++;
  });
  const total = flat.length;

  const dominantCount = counts.dominant + counts.heterozygous;
  const recessiveCount = counts.recessive;
  const ratioStr =
    recessiveCount === 0
      ? `${dominantCount}:0`
      : dominantCount === 0
        ? `0:${recessiveCount}`
        : `${dominantCount}:${recessiveCount}`;

  const letter = parent1[0].toUpperCase();
  const genotypeKeys = [letter + letter, letter + letter.toLowerCase(), letter.toLowerCase() + letter.toLowerCase()];

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 items-center justify-center gap-8 overflow-auto p-4">
        {/* Square */}
        <div className="flex flex-col items-center gap-2">
          {/* Column headers: parent 1 gametes */}
          <div className="flex items-center gap-2">
            <div className="w-20" />
            <span className="text-[11px] text-gray-500">Parent 1: </span>
            <span className="text-sm font-bold text-pink-300 font-mono">{parent1}</span>
            {gametes1.map((g, j) => (
              <div
                key={`col-${j}`}
                className="flex h-11 w-16 items-center justify-center rounded-lg border border-pink-500/25 bg-pink-500/10 font-mono text-sm font-bold text-pink-300"
              >
                {g}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div className="flex flex-col gap-2">
            {offspring.map((row, i) => (
              <div key={`row-${i}`} className="flex items-center gap-2">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-gray-600">{i === 0 ? "Parent 2:" : ""}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className={`text-sm font-bold font-mono ${i === 0 ? "text-teal-300" : "text-transparent"}`}>
                    {parent2}
                  </span>
                </div>
                <div className="flex h-14 w-10 items-center justify-center rounded-lg border border-teal-500/25 bg-teal-500/10 font-mono text-sm font-bold text-teal-300">
                  {gametes2[i]}
                </div>
                {row.map((genotype, j) => {
                  const cls = classify(genotype);
                  const s = GENOTYPE_STYLES[cls];
                  return (
                    <div
                      key={`cell-${i}-${j}`}
                      className={`flex h-14 w-20 flex-col items-center justify-center rounded-xl border ${s.border} ${s.bg}`}
                    >
                      <span className={`font-mono text-lg font-bold ${s.text}`}>{genotype}</span>
                      <span className="text-[9px] text-gray-500">{s.label.split(" ")[0]}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Parent selectors */}
          <div className="mt-2 flex flex-wrap items-center gap-4 rounded-xl border border-gray-700/40 bg-gray-900/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500">Parent 1:</span>
              {(["AA", "Aa", "aa"] as const).map((g) => (
                <button
                  key={`p1-${g}`}
                  onClick={() => onUpdate?.({ parent1: g })}
                  className={`rounded-md px-2.5 py-1 font-mono text-xs font-bold transition-colors ${
                    parent1 === g
                      ? "bg-pink-600/70 text-white"
                      : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500">Parent 2:</span>
              {(["AA", "Aa", "aa"] as const).map((g) => (
                <button
                  key={`p2-${g}`}
                  onClick={() => onUpdate?.({ parent2: g })}
                  className={`rounded-md px-2.5 py-1 font-mono text-xs font-bold transition-colors ${
                    parent2 === g
                      ? "bg-teal-600/70 text-white"
                      : "bg-gray-700/40 text-gray-400 hover:bg-gray-600/50"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results panel */}
        <div className="flex w-72 flex-col gap-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Offspring Analysis</h4>

          {/* Genotype ratio */}
          <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-3">
            <p className="mb-2 text-[11px] text-gray-500">Genotype ratio</p>
            {genotypeKeys.map((g) => {
              const count =
                classify(g) === "homozygous-dominant" ? counts.dominant
                : classify(g) === "homozygous-recessive" ? counts.recessive
                : counts.heterozygous;
              return (
                <div key={`count-${g}`} className="mb-1.5 flex items-center gap-2">
                  <span className="w-9 font-mono text-xs font-bold text-gray-300">{g}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-800">
                    <div
                      className={`h-full rounded-full ${
                        classify(g) === "homozygous-dominant" ? "bg-emerald-500"
                        : classify(g) === "heterozygous" ? "bg-blue-500" : "bg-yellow-500"
                      }`}
                      style={{ width: `${(count / total) * 100}%` }}
                    />
                  </div>
                  <span className="w-14 text-right font-mono text-[11px] text-gray-400">
                    {count}/{total} ({Math.round((count / total) * 100)}%)
                  </span>
                </div>
              );
            })}
          </div>

          {/* Phenotype ratio */}
          <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-3">
            <p className="mb-2 text-[11px] text-gray-500">Phenotype ratio</p>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="w-20 truncate text-[11px] text-emerald-300">{traitDominant}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-800">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(dominantCount / total) * 100}%` }} />
              </div>
              <span className="w-14 text-right font-mono text-[11px] text-gray-400">
                {dominantCount}/{total}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 truncate text-[11px] text-yellow-300">{traitRecessive}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-800">
                <div className="h-full rounded-full bg-yellow-500" style={{ width: `${(recessiveCount / total) * 100}%` }} />
              </div>
              <span className="w-14 text-right font-mono text-[11px] text-gray-400">
                {recessiveCount}/{total}
              </span>
            </div>
            <p className="mt-2 text-center font-mono text-sm font-bold text-gray-300">≈ {ratioStr} ratio</p>
          </div>

          {/* Trait name editors */}
          <div className="flex flex-col gap-2 rounded-xl border border-gray-700/40 bg-gray-900/40 p-3">
            <p className="text-[11px] text-gray-500">Trait labels (letter {letter})</p>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 text-[11px] text-gray-500">
                Dominant:
                <input
                  type="text"
                  value={traitDominant}
                  onChange={(e) => onUpdate?.({ traitDominant: e.target.value })}
                  className="flex-1 rounded border border-gray-600/50 bg-gray-800/60 px-2 py-1 text-xs text-emerald-300 focus:border-emerald-500 focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-2 text-[11px] text-gray-500">
                Recessive:
                <input
                  type="text"
                  value={traitRecessive}
                  onChange={(e) => onUpdate?.({ traitRecessive: e.target.value })}
                  className="flex-1 rounded border border-gray-600/50 bg-gray-800/60 px-2 py-1 text-xs text-yellow-300 focus:border-yellow-500 focus:outline-none"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-gray-700/50 bg-gray-900/80 px-4 py-2 text-xs font-mono">
        <span className="text-pink-400">cross: {parent1} × {parent2}</span>
        <span className="text-gray-400">genotypes: {counts.dominant}·{counts.heterozygous}·{counts.recessive}</span>
        <span className="text-emerald-400">phenotype: {ratioStr}</span>
        <span className="text-gray-500">{parent1 === letter + letter.toLowerCase() && parent2 === parent1 ? "classic 3:1 monohybrid" : "monohybrid cross"}</span>
      </div>
    </div>
  );
}
