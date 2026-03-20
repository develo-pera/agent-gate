interface HealthScoreProps {
  score: number;
  size?: number;
}

function getScoreColor(score: number): string {
  if (score <= 40) return "hsl(var(--destructive))";
  if (score <= 70) return "hsl(var(--warning))";
  return "hsl(var(--success))";
}

function getScoreLabel(score: number): string {
  if (score <= 40) return "At Risk";
  if (score <= 70) return "Caution";
  return "Healthy";
}

export function HealthScore({ score, size = 120 }: HealthScoreProps) {
  const radius = 70;
  const strokeWidth = 20;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const strokeDashoffset =
    circumference - (clampedScore / 100) * circumference;
  const color = getScoreColor(clampedScore);
  const label = getScoreLabel(clampedScore);
  const viewBox = "0 0 200 200";

  return (
    <div
      className="relative inline-flex flex-col items-center"
      style={{ width: size, height: size + 24 }}
    >
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        className="overflow-visible"
      >
        {/* Background circle */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        {/* Score arc */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 100 100)"
        />
        {/* Score number */}
        <text
          x="100"
          y="105"
          textAnchor="middle"
          className="text-sm font-semibold fill-foreground"
          fontSize="32"
        >
          {clampedScore}
        </text>
      </svg>
      {/* Label below */}
      <span
        className="text-xs font-medium"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  );
}
