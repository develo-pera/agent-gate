/**
 * Inline SVG robot sprite strip: 4 columns x 3 rows of 32x32 frames.
 * viewBox="0 0 128 96" rendered at 384x288 CSS pixels (3x scale).
 *
 * Row 0 (y=0..31):  idle  — subtle antenna bob / breathing
 * Row 1 (y=32..63): walk  — legs alternating, body bob
 * Row 2 (y=64..95): work  — arms moving, sparks
 *
 * Colors use CSS custom properties:
 *   --sprite-body:  body fill (set per-agent via addressToSpriteColor)
 *   --sprite-visor: visor/eye fill (fixed accent)
 */

const BODY = "var(--sprite-body, hsl(225, 70%, 60%))";
const VISOR = "var(--sprite-visor, hsl(180, 80%, 70%))";
const DARK = "#333";
const SPARK = "hsl(45, 100%, 65%)";

/* ---------- helper: draw one robot frame at (ox, oy) ---------- */

interface FrameOpts {
  ox: number; // cell origin x (0, 32, 64, 96)
  oy: number; // cell origin y (0, 32, 64)
  antennaH: number; // antenna top offset (0 or 1 for bob)
  legL: number; // left leg extension (0 or 1)
  legR: number; // right leg extension (0 or 1)
  bodyOff: number; // body vertical offset (0 or 1 for bob)
  armL: number; // left arm y-offset (0 or 1)
  armR: number; // right arm y-offset (0 or 1)
  sparks?: Array<[number, number]>; // spark positions relative to cell
}

function frame({
  ox,
  oy,
  antennaH,
  legL,
  legR,
  bodyOff,
  armL,
  armR,
  sparks,
}: FrameOpts) {
  // Robot centered in 32x32 cell: body at ~x=12, y=8, 8px wide, 10px tall
  const bx = ox + 12; // body left
  const by = oy + 8 + bodyOff; // body top

  return (
    <g key={`${ox}-${oy}`}>
      {/* Antenna */}
      <rect x={bx + 3} y={by - 3 + antennaH} width={2} height={3} fill={DARK} />
      <rect x={bx + 3} y={by - 4 + antennaH} width={2} height={1} fill={VISOR} />

      {/* Head */}
      <rect x={bx} y={by} width={8} height={5} fill={BODY} />
      {/* Visor slit */}
      <rect x={bx + 1} y={by + 1} width={6} height={2} fill={VISOR} />
      {/* Eye dots */}
      <rect x={bx + 2} y={by + 1} width={1} height={1} fill={DARK} />
      <rect x={bx + 5} y={by + 1} width={1} height={1} fill={DARK} />

      {/* Body */}
      <rect x={bx} y={by + 5} width={8} height={6} fill={BODY} />
      {/* Body detail stripe */}
      <rect x={bx + 1} y={by + 7} width={6} height={1} fill={DARK} opacity={0.3} />

      {/* Left arm */}
      <rect x={bx - 2} y={by + 5 + armL} width={2} height={4} fill={BODY} />
      {/* Right arm */}
      <rect x={bx + 8} y={by + 5 + armR} width={2} height={4} fill={BODY} />

      {/* Left leg */}
      <rect x={bx + 1} y={by + 11} width={2} height={3 + legL} fill={DARK} />
      {/* Right leg */}
      <rect x={bx + 5} y={by + 11} width={2} height={3 + legR} fill={DARK} />

      {/* Feet */}
      <rect x={bx} y={by + 14 + legL} width={3} height={1} fill={BODY} />
      <rect x={bx + 5} y={by + 14 + legR} width={3} height={1} fill={BODY} />

      {/* Sparks (work animation) */}
      {sparks?.map(([sx, sy], i) => (
        <rect
          key={`spark-${i}`}
          x={ox + sx}
          y={oy + sy}
          width={1}
          height={1}
          fill={SPARK}
        />
      ))}
    </g>
  );
}

export function RobotSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 128 96"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      className={className}
      style={{ width: 384, height: 288 }}
    >
      {/* ===== Row 0: Idle (antenna bob, subtle breathing) ===== */}
      {frame({ ox: 0,  oy: 0, antennaH: 0, legL: 0, legR: 0, bodyOff: 0, armL: 0, armR: 0 })}
      {frame({ ox: 32, oy: 0, antennaH: 1, legL: 0, legR: 0, bodyOff: 0, armL: 0, armR: 0 })}
      {frame({ ox: 64, oy: 0, antennaH: 0, legL: 0, legR: 0, bodyOff: 1, armL: 0, armR: 0 })}
      {frame({ ox: 96, oy: 0, antennaH: 1, legL: 0, legR: 0, bodyOff: 1, armL: 0, armR: 0 })}

      {/* ===== Row 1: Walk (legs alternate, body bobs) ===== */}
      {frame({ ox: 0,  oy: 32, antennaH: 0, legL: 1, legR: 0, bodyOff: 0, armL: 1, armR: 0 })}
      {frame({ ox: 32, oy: 32, antennaH: 0, legL: 0, legR: 0, bodyOff: 1, armL: 0, armR: 0 })}
      {frame({ ox: 64, oy: 32, antennaH: 0, legL: 0, legR: 1, bodyOff: 0, armL: 0, armR: 1 })}
      {frame({ ox: 96, oy: 32, antennaH: 0, legL: 0, legR: 0, bodyOff: 1, armL: 0, armR: 0 })}

      {/* ===== Row 2: Work (arms move, sparks fly) ===== */}
      {frame({ ox: 0,  oy: 64, antennaH: 0, legL: 0, legR: 0, bodyOff: 0, armL: 0, armR: -2, sparks: [[24, 8], [25, 10]] })}
      {frame({ ox: 32, oy: 64, antennaH: 1, legL: 0, legR: 0, bodyOff: 0, armL: -2, armR: 0, sparks: [[6, 9], [8, 7]] })}
      {frame({ ox: 64, oy: 64, antennaH: 0, legL: 0, legR: 0, bodyOff: 0, armL: 0, armR: -2, sparks: [[25, 7], [23, 9], [26, 11]] })}
      {frame({ ox: 96, oy: 64, antennaH: 1, legL: 0, legR: 0, bodyOff: 0, armL: -2, armR: 0, sparks: [[7, 8], [5, 10], [9, 6]] })}
    </svg>
  );
}
