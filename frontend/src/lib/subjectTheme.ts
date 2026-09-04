/**
 * Subject theming — one coherent color system across every subject.
 *
 * Maps backend subject strings (physics, math, computer_science,
 * biology, chemistry, …) to display labels, accent colors, and
 * monogram glyphs so badges, panels, and headers stay consistent.
 */

export interface SubjectTheme {
  label: string;
  /** Tailwind text color class. */
  text: string;
  /** Tailwind background tint class. */
  bg: string;
  /** Tailwind ring/border color class. */
  ring: string;
  /** Single uppercase letter for avatar chips. */
  monogram: string;
}

const FALLBACK: SubjectTheme = {
  label: "General",
  text: "text-steel-600",
  bg: "bg-steel-500/10",
  ring: "ring-steel-500/25",
  monogram: "◆",
};

const SUBJECTS: Record<string, SubjectTheme> = {
  physics: {
    label: "Physics",
    text: "text-azure-700",
    bg: "bg-azure-500/12",
    ring: "ring-azure-500/30",
    monogram: "P",
  },
  math: {
    label: "Mathematics",
    text: "text-violet-700",
    bg: "bg-violet-500/10",
    ring: "ring-violet-500/25",
    monogram: "∑",
  },
  mathematics: {
    label: "Mathematics",
    text: "text-violet-700",
    bg: "bg-violet-500/10",
    ring: "ring-violet-500/25",
    monogram: "∑",
  },
  computer_science: {
    label: "Computer Science",
    text: "text-emerald-700",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/25",
    monogram: "λ",
  },
  cs: {
    label: "Computer Science",
    text: "text-emerald-700",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/25",
    monogram: "λ",
  },
  biology: {
    label: "Biology",
    text: "text-rose-700",
    bg: "bg-rose-500/10",
    ring: "ring-rose-500/25",
    monogram: "☄",
  },
  chemistry: {
    label: "Chemistry",
    text: "text-amber-700",
    bg: "bg-amber-500/10",
    ring: "ring-amber-600/25",
    monogram: "⚗",
  },
  general: {
    label: "General",
    text: "text-steel-600",
    bg: "bg-steel-500/10",
    ring: "ring-steel-500/25",
    monogram: "◆",
  },
};

export function subjectTheme(subject: string | undefined | null): SubjectTheme {
  if (!subject) return FALLBACK;
  return SUBJECTS[subject.toLowerCase()] ?? FALLBACK;
}

/** Humanize a concept slug: "projectile_motion" → "Projectile Motion". */
export function conceptLabel(concept: string | undefined | null): string {
  if (!concept) return "";
  return concept
    .split(/[_\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
