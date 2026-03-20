interface DonutChartProps {
  principal: number;
  yieldAmount: number;
  size?: number;
}

export function DonutChart({
  principal,
  yieldAmount,
  size = 200,
}: DonutChartProps) {
  const radius = 70;
  const strokeWidth = 20;
  const circumference = 2 * Math.PI * radius;
  const total = principal + yieldAmount;

  // Handle empty state
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 200 200">
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="hsl(var(--chart-4))"
          strokeWidth={strokeWidth}
        />
        <text
          x="100"
          y="96"
          textAnchor="middle"
          className="text-sm font-semibold fill-foreground"
          fontSize="16"
        >
          0.0000
        </text>
        <text
          x="100"
          y="116"
          textAnchor="middle"
          className="text-xs fill-muted-foreground"
          fontSize="12"
        >
          wstETH
        </text>
      </svg>
    );
  }

  const principalRatio = principal / total;
  const yieldRatio = yieldAmount / total;

  const principalDash = principalRatio * circumference;
  const yieldDash = yieldRatio * circumference;

  // Principal segment starts at top
  const principalOffset = 0;
  // Yield segment starts after principal
  const yieldOffset = circumference - yieldDash;

  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      {/* Principal segment (purple, chart-1) */}
      <circle
        cx="100"
        cy="100"
        r={radius}
        fill="none"
        stroke="hsl(var(--chart-1))"
        strokeWidth={strokeWidth}
        strokeDasharray={`${principalDash} ${circumference - principalDash}`}
        strokeDashoffset={principalOffset}
        transform="rotate(-90 100 100)"
      />
      {/* Yield segment (green, chart-2) */}
      <circle
        cx="100"
        cy="100"
        r={radius}
        fill="none"
        stroke="hsl(var(--chart-2))"
        strokeWidth={strokeWidth}
        strokeDasharray={`${yieldDash} ${circumference - yieldDash}`}
        strokeDashoffset={yieldOffset}
        transform="rotate(-90 100 100)"
      />
      {/* Center text: total */}
      <text
        x="100"
        y="96"
        textAnchor="middle"
        className="text-sm font-semibold fill-foreground"
        fontSize="16"
      >
        {total.toFixed(4)}
      </text>
      {/* Label */}
      <text
        x="100"
        y="116"
        textAnchor="middle"
        className="text-xs fill-muted-foreground"
        fontSize="12"
      >
        wstETH
      </text>
    </svg>
  );
}
