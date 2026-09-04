import Link from "next/link";
import { Logo } from "@/components/Logo";
import { StatusChip } from "@/components/ui/StatusChip";
import { subjectTheme } from "@/lib/subjectTheme";

/**
 * Landing page — the storm that clears into morning.
 *
 * A cinematic first impression: the hero IS a stormy dawn sky
 * (deep slate overhead breaking to bright azure at the horizon),
 * with a live-drawn trajectory arcing over the sunrise. Scrolling
 * carries you out of the storm into a light, airy morning —
 * pipeline, disciplines, and the call to the classroom.
 */

const DISCIPLINES = [
  {
    subject: "physics",
    title: "Physics",
    desc: "Projectiles, waves, collisions, optics — simulated live from the physics you speak.",
    viz: "24 interactive models",
  },
  {
    subject: "math",
    title: "Mathematics",
    desc: "Functions, derivatives, integrals — graphs and proofs drawn as you describe them.",
    viz: "Analytic plotting",
  },
  {
    subject: "computer_science",
    title: "Computer Science",
    desc: "Sorting, pathfinding, recursion — algorithms stepping through their own execution.",
    viz: "Step-by-step tracing",
  },
  {
    subject: "biology",
    title: "Biology",
    desc: "Cells, DNA, genetics — microscopic structures rendered as living diagrams.",
    viz: "Structural rendering",
  },
  {
    subject: "chemistry",
    title: "Chemistry",
    desc: "Atoms, molecules, titrations — reactions and structures with real-time parameters.",
    viz: "Molecular visuals",
  },
];

const PIPELINE_STEPS = [
  { k: "01", title: "Speak", desc: "Teach naturally — voice or text, no syntax to learn." },
  { k: "02", title: "Understand", desc: "The AI planner parses intent, concepts and numbers." },
  { k: "03", title: "Visualize", desc: "A matching interactive scene composes itself instantly." },
];

const TICKER = [
  "Pendulum",
  "Projectile Motion",
  "Wave Interference",
  "Ray Optics",
  "Titration Curves",
  "Punnett Squares",
  "DNA Replication",
  "Enzyme Kinetics",
  "Riemann Sums",
  "Unit Circle",
  "Derivatives",
  "Vector Fields",
  "Dijkstra Paths",
  "Tower of Hanoi",
  "Binary Trees",
  "BFS & DFS",
  "Sorting",
  "Atomic Structure",
  "Molecular Bonds",
  "Free Fall",
  "Momentum & Collisions",
  "Springs & SHM",
];

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col">
      {/* ══ Storm hero — the dawn sky ═══════════════════════════ */}
      <section className="storm-sky relative flex min-h-[96vh] flex-col overflow-hidden">
        {/* Atmosphere: clouds, rain, dawn glow, grain */}
        <div className="storm-cloud storm-cloud-a h-[42vmax] w-[62vmax] -top-[10vmax] -left-[8vmax]" aria-hidden="true" />
        <div className="storm-cloud storm-cloud-b h-[36vmax] w-[52vmax] top-[6vmax] -right-[10vmax]" aria-hidden="true" />
        <div className="rain-layer" aria-hidden="true" />
        <div className="dawn-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="noise-overlay absolute inset-0 opacity-[0.04] mix-blend-overlay" aria-hidden="true" />

        {/* ── Navigation ── */}
        <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
          <Link href="/" aria-label="TasawwurAI home" className="transition-opacity hover:opacity-85">
            <Logo wordmark size={34} onDark />
          </Link>
          <nav className="flex items-center gap-3">
            <a
              href="http://localhost:8000/docs"
              className="hidden rounded-lg px-4 py-2 text-sm font-medium text-mist-300/80 transition-colors hover:bg-white/10 hover:text-white sm:block"
            >
              API Docs
            </a>
            <Link
              href="/session/demo"
              className="rounded-lg bg-white/10 px-5 py-2 text-sm font-semibold text-mist-100 ring-1 ring-white/20 backdrop-blur transition-all hover:bg-white/15 hover:ring-white/35"
            >
              Open Classroom
            </Link>
          </nav>
        </header>

        {/* ── Hero content ── */}
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 py-14 text-center sm:px-10">
          {/* Status strip */}
          <div className="animate-fade-in mb-8 flex flex-wrap items-center justify-center gap-2">
            <StatusChip variant="live" size="xs" tone="dark" />
            <span className="rounded-full bg-white/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-mist-200/80 ring-1 ring-white/15">
              Real-time engine online
            </span>
            <span className="rounded-full bg-white/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-mist-200/80 ring-1 ring-white/15">
              24 visualization modules
            </span>
          </div>

          <h1 className="animate-fade-in font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl">
            Teach by speaking.
            <br />
            Watch{" "}
            <span className="font-serif font-normal italic tracking-normal text-gradient-storm">
              understanding
            </span>{" "}
            take shape.
          </h1>

          <p className="animate-fade-in mt-6 max-w-2xl text-base leading-relaxed text-mist-200/75 sm:text-lg">
            TasawwurAI listens to your lesson and composes living, interactive
            visualizations in real time — across physics, mathematics, computer
            science, biology and chemistry.
          </p>

          {/* CTAs */}
          <div className="animate-fade-in mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href="/session/demo"
              className="group relative overflow-hidden rounded-xl bg-azure-500 px-8 py-3.5 text-sm font-semibold text-dusk-900 shadow-[0_12px_40px_-12px_rgba(136,189,242,0.65)] transition-all hover:bg-azure-400 hover:shadow-[0_16px_48px_-12px_rgba(136,189,242,0.8)] active:scale-[0.98]"
            >
              Enter the Classroom
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </Link>
            <a
              href="http://localhost:8000/docs"
              className="rounded-xl border border-white/25 bg-white/10 px-8 py-3.5 text-sm font-semibold text-mist-100 backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/15 active:scale-[0.98]"
            >
              Explore the API
            </a>
          </div>

          {/* Sky viewport — a trajectory arcing over the sunrise */}
          <div className="animate-fade-in relative mt-14 flex w-full max-w-2xl items-center justify-center">
            <div
              className="glass-dark hairline-top relative w-full overflow-hidden rounded-3xl px-6 py-10 sm:py-12"
              style={{
                background:
                  "linear-gradient(180deg, rgba(26,38,49,0.66) 0%, rgba(44,58,71,0.46) 45%, rgba(106,137,167,0.36) 75%, rgba(136,189,242,0.38) 100%)",
              }}
            >
              <svg viewBox="0 0 560 220" className="mx-auto w-full max-w-lg" aria-hidden="true">
                <defs>
                  <linearGradient id="hero-grad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6A89A7" />
                    <stop offset="50%" stopColor="#88BDF2" />
                    <stop offset="100%" stopColor="#BDDDFC" />
                  </linearGradient>
                  <linearGradient id="horizon-grad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgba(189,221,252,0)" />
                    <stop offset="50%" stopColor="rgba(189,221,252,0.55)" />
                    <stop offset="100%" stopColor="rgba(189,221,252,0)" />
                  </linearGradient>
                  <radialGradient id="hero-sun" cx="0.5" cy="0.6" r="0.9">
                    <stop offset="0%" stopColor="#FDFEFF" />
                    <stop offset="45%" stopColor="#E9F1FA" />
                    <stop offset="100%" stopColor="rgba(189,221,252,0)" />
                  </radialGradient>
                </defs>

                {/* Frame grid */}
                {Array.from({ length: 13 }).map((_, i) => (
                  <line
                    key={`v${i}`}
                    x1={40 + i * 40}
                    y1="20"
                    x2={40 + i * 40}
                    y2="185"
                    stroke="rgba(189,221,252,0.07)"
                    strokeWidth="1"
                  />
                ))}
                {Array.from({ length: 5 }).map((_, i) => (
                  <line
                    key={`h${i}`}
                    x1="40"
                    y1={29 + i * 32}
                    x2="520"
                    y2={29 + i * 32}
                    stroke="rgba(189,221,252,0.07)"
                    strokeWidth="1"
                  />
                ))}

                {/* Sun rising on the horizon */}
                <circle cx="280" cy="185" r="34" fill="url(#hero-sun)" />
                <circle cx="280" cy="185" r="11" fill="#FDFEFF" opacity="0.95" />

                {/* Horizon */}
                <line x1="20" y1="185" x2="540" y2="185" stroke="url(#horizon-grad)" strokeWidth="1.5" />

                {/* Trajectory — a parabola that draws itself over the dawn */}
                <path
                  className="hero-draw"
                  d="M60 185 Q 280 -40 500 185"
                  fill="none"
                  stroke="url(#hero-grad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Ghost dots at equal intervals */}
                {[
                  [0.2, 113],
                  [0.35, 82.6],
                  [0.5, 72.5],
                  [0.65, 82.6],
                  [0.8, 113],
                ].map(([t, y]) => (
                  <circle key={t} cx={60 + 440 * t} cy={y} r="3" fill="rgba(189,221,252,0.4)" />
                ))}

                {/* Launch + landing markers */}
                <circle cx="60" cy="185" r="5" fill="#88BDF2" />
                <circle cx="60" cy="185" r="9" fill="none" stroke="rgba(189,221,252,0.5)" />
                <circle cx="500" cy="185" r="3.5" fill="rgba(189,221,252,0.45)" />

                {/* Annotation */}
                <text
                  x="280"
                  y="34"
                  textAnchor="middle"
                  fill="rgba(189,221,252,0.85)"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                  letterSpacing="2"
                >
                  VOICE → CONCEPT → SCENE
                </text>
              </svg>

              {/* Floating meta chips */}
              <span className="glass-dark absolute left-4 top-4 rounded-md px-2 py-1 font-mono text-[10px] text-mist-200/80">
                physics.projectile
              </span>
              <span className="glass-dark absolute bottom-4 right-4 rounded-md px-2 py-1 font-mono text-[10px] text-mist-200/80">
                v₀ = 20 m/s · θ = 45°
              </span>
            </div>
          </div>
        </div>

        {/* Scroll hint — the storm is about to clear */}
        <div className="relative z-10 flex flex-col items-center gap-1.5 pb-8">
          <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-mist-300/50">
            the sky clears
          </span>
          <svg
            className="h-4 w-4 animate-bounce text-mist-300/50"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>

        {/* Fade from storm into morning */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-mist-100" />
      </section>

      {/* ══ Concept ticker — light breaking ═════════════════════ */}
      <section aria-label="Visualization catalog" className="border-b border-steel-200/70 bg-mist-100 py-5">
        <div className="marquee">
          <div className="marquee-track items-center">
            {[...TICKER, ...TICKER].map((t, i) => (
              <span
                key={i}
                className="mr-10 flex items-center gap-10 font-mono text-[11px] uppercase tracking-[0.22em] text-steel-500"
              >
                {t}
                <span className="text-azure-400" aria-hidden="true">
                  ·
                </span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Pipeline — the morning workshop ═════════════════════ */}
      <section className="mx-auto w-full max-w-5xl px-6 py-16 sm:px-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-azure-700">
              how it works
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-dusk-800">
              From spoken word to living scene
            </h2>
          </div>
          <span className="hidden font-mono text-[11px] uppercase tracking-widest text-steel-400 sm:block">
            24 modules · 5 disciplines
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {PIPELINE_STEPS.map((s, i) => (
            <div
              key={s.k}
              className="animate-fade-in group relative overflow-hidden rounded-2xl border border-steel-200/80 bg-white/80 p-6 shadow-[0_1px_2px_rgba(56,73,89,0.05)] transition-all duration-300 hover:-translate-y-1 hover:border-azure-500/40 hover:shadow-[0_16px_40px_-20px_rgba(56,73,89,0.28)]"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <span className="font-mono text-xs font-semibold text-azure-700">{s.k}</span>
              <h3 className="mt-2 font-display text-lg font-semibold text-dusk-800">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-steel-600">{s.desc}</p>
              <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-azure-400/10 blur-2xl transition-colors duration-300 group-hover:bg-azure-400/20" />
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-azure-500/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </div>
          ))}
        </div>
      </section>

      {/* ══ Disciplines ═════════════════════════════════════════ */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-16 sm:px-10">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="font-display text-xl font-semibold text-dusk-800">
            One intelligence, five disciplines
          </h2>
          <span className="hidden font-mono text-[11px] uppercase tracking-widest text-steel-400 sm:block">
            concept catalog
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {DISCIPLINES.map((d) => {
            const theme = subjectTheme(d.subject);
            return (
              <Link
                key={d.subject}
                href="/session/demo"
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-steel-200/80 bg-white/80 p-5 shadow-[0_1px_2px_rgba(56,73,89,0.05)] transition-all duration-300 hover:-translate-y-1.5 hover:border-azure-500/40 hover:shadow-[0_16px_40px_-20px_rgba(56,73,89,0.3)]"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg font-mono text-sm ring-1 ${theme.bg} ${theme.text} ${theme.ring}`}
                >
                  {theme.monogram}
                </span>
                <h3 className="mt-3 font-display text-base font-semibold text-dusk-800">{d.title}</h3>
                <p className="mt-1.5 flex-1 text-xs leading-relaxed text-steel-600">{d.desc}</p>
                <span
                  className={`mt-4 font-mono text-[10px] uppercase tracking-wider ${theme.text} opacity-70 transition-opacity group-hover:opacity-100`}
                >
                  {d.viz} →
                </span>
                <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-azure-500/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* ══ Call to the classroom ═══════════════════════════════ */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-20 sm:px-10">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-azure-200 via-azure-300 to-azure-200 px-8 py-14 text-center sm:py-16">
          <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/40 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-mist-300/60 blur-3xl" aria-hidden="true" />
          <p className="relative font-mono text-[10px] uppercase tracking-[0.3em] text-dusk-600/80">
            real-time · voice-driven · interactive
          </p>
          <h2 className="relative mt-3 font-display text-2xl font-bold tracking-tight text-dusk-900 sm:text-3xl">
            Step up to the whiteboard.
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-sm leading-relaxed text-dusk-700/85 sm:text-base">
            Open a session, press the mic, and teach. Every sentence becomes a
            scene your students can touch.
          </p>
          <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/session/demo"
              className="group relative overflow-hidden rounded-xl bg-dusk-800 px-8 py-3.5 text-sm font-semibold text-white shadow-[0_12px_32px_-12px_rgba(44,58,71,0.6)] transition-all hover:bg-dusk-700 active:scale-[0.98]"
            >
              Enter the Classroom
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </Link>
            <a
              href="http://localhost:8000/docs"
              className="rounded-xl border border-dusk-800/20 px-8 py-3.5 text-sm font-semibold text-dusk-800 transition-all hover:border-dusk-800/40 hover:bg-white/40 active:scale-[0.98]"
            >
              Explore the API
            </a>
          </div>
        </div>
      </section>

      {/* ══ Footer ══════════════════════════════════════════════ */}
      <footer className="border-t border-steel-200/70 px-6 py-6 sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-steel-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Logo size={18} animated={false} />
            <span className="font-mono">TasawwurAI · Real-time visualization studio</span>
          </div>
          <div className="flex items-center gap-4 font-mono">
            <span>Next.js · FastAPI · WebSockets</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
