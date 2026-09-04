/**
 * Logo — the TasawwurAI brand mark.
 *
 * A sky-lit core (the "idea") encircled by an orbiting node on an
 * elliptical path — knowledge held in motion. Optionally shows the
 * wordmark with a gradient "AI". Pass `onDark` when the mark sits on
 * a dark surface (e.g. the storm hero).
 */

interface Props {
  size?: number;
  wordmark?: boolean;
  animated?: boolean;
  /** Set when rendered on a dark surface — swaps wordmark contrast. */
  onDark?: boolean;
  className?: string;
}

export function Logo({ size = 36, wordmark = false, animated = true, onDark = false, className = "" }: Props) {
  const core = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={animated ? "" : "[&_*]:!animate-none"}
    >
      <defs>
        <radialGradient id="logo-core" cx="0.4" cy="0.35" r="0.9">
          <stop offset="0%" stopColor="#E9F1FA" />
          <stop offset="55%" stopColor="#88BDF2" />
          <stop offset="100%" stopColor="#4E88D4" />
        </radialGradient>
      </defs>

      {/* Outer orbit ring */}
      <ellipse
        cx="24"
        cy="24"
        rx="19"
        ry="8.5"
        stroke="rgba(136,189,242,0.45)"
        strokeWidth="1.4"
        transform="rotate(-24 24 24)"
      />

      {/* Second, counter-rotating orbit */}
      <g className={animated ? "orbit-rev" : ""} style={{ transformOrigin: "24px 24px" }}>
        <ellipse
          cx="24"
          cy="24"
          rx="19"
          ry="8.5"
          stroke="rgba(106,137,167,0.35)"
          strokeWidth="1"
          transform="rotate(-24 24 24)"
        />
      </g>

      {/* Spinning orbit group: ring + node */}
      <g className={animated ? "orbit-slow" : ""} style={{ transformOrigin: "24px 24px" }}>
        <ellipse
          cx="24"
          cy="24"
          rx="14.5"
          ry="14.5"
          stroke="rgba(136,189,242,0.5)"
          strokeWidth="1"
          strokeDasharray="2 5"
        />
        {/* Orbiting node */}
        <circle cx="24" cy="9.5" r="2.4" fill="#BDDDFC">
          <animate attributeName="opacity" values="1;0.5;1" dur="2.4s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* Sky-lit core */}
      <circle cx="24" cy="24" r="6.5" fill="url(#logo-core)" />
      <circle cx="24" cy="24" r="10.5" stroke="rgba(78,136,212,0.3)" strokeWidth="1" fill="none" />
      <circle cx="21.8" cy="21.8" r="1.6" fill="#F8FBFE" opacity="0.9" />
    </svg>
  );

  if (!wordmark) {
    return <span className={`inline-flex items-center ${className}`}>{core}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {core}
      <span
        className={`font-display text-lg font-semibold tracking-tight ${
          onDark ? "text-white" : "text-dusk-800"
        }`}
      >
        Tasawwur<span className={onDark ? "text-gradient-storm" : "text-gradient-ai"}>AI</span>
      </span>
    </span>
  );
}
