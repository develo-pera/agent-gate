"use client";

import { useVaultStatus } from "@/lib/hooks/use-treasury";
import { HealthScore } from "@/components/shared/health-score";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorCard } from "@/components/shared/error-card";

interface HealthMetrics {
  score: number;
  collateralRatio: number;
  utilizationRate: number;
  alerts: number;
}

function computeHealthMetrics(
  vaultData: readonly [bigint, bigint, bigint, boolean] | undefined,
): HealthMetrics {
  if (!vaultData)
    return { score: 0, collateralRatio: 0, utilizationRate: 0, alerts: 0 };

  const [principal, yield_, total, hasVault] = vaultData;
  if (!hasVault || principal === BigInt(0)) {
    return { score: 50, collateralRatio: 100, utilizationRate: 0, alerts: 0 };
  }

  // Collateral ratio: total / principal * 100 (>100% is good)
  const collateralRatio = (Number(total) / Number(principal)) * 100;

  // Utilization rate: how much yield is being used (lower is healthier)
  const utilizationRate =
    Number(yield_) > 0
      ? Math.min(
          100,
          ((Number(principal) - Number(total - yield_)) / Number(principal)) *
            100,
        )
      : 0;

  // Alerts: flag if collateral < 105%, or high utilization
  let alerts = 0;
  if (collateralRatio < 105) alerts++;
  if (utilizationRate > 80) alerts++;

  // Score: weighted average (higher is better)
  const collateralScore = Math.min(100, collateralRatio - 50);
  const utilizationScore = 100 - utilizationRate;
  const alertPenalty = alerts * 15;

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        collateralScore * 0.5 +
          utilizationScore * 0.3 +
          100 * 0.2 -
          alertPenalty,
      ),
    ),
  );

  return {
    score,
    collateralRatio: Math.round(collateralRatio * 100) / 100,
    utilizationRate: Math.round(utilizationRate * 100) / 100,
    alerts,
  };
}

function getBadgeClass(
  metric: "collateral" | "utilization" | "alerts",
  value: number,
): string {
  if (metric === "collateral") {
    if (value >= 110) return "bg-success/20 text-success";
    if (value >= 100) return "bg-warning/20 text-warning";
    return "bg-destructive/20 text-destructive";
  }
  if (metric === "utilization") {
    if (value <= 50) return "bg-success/20 text-success";
    if (value <= 80) return "bg-warning/20 text-warning";
    return "bg-destructive/20 text-destructive";
  }
  // alerts
  if (value === 0) return "bg-success/20 text-success";
  if (value === 1) return "bg-warning/20 text-warning";
  return "bg-destructive/20 text-destructive";
}

export function HealthReport() {
  const { data: vaultData, isLoading, error, refetch } = useVaultStatus();

  if (isLoading) {
    return <Skeleton className="h-[280px] rounded-xl" />;
  }

  if (error) {
    return (
      <ErrorCard
        message="Failed to load vault data. Check your connection and try again."
        onRetry={refetch}
      />
    );
  }

  const metrics = computeHealthMetrics(
    vaultData as [bigint, bigint, bigint, boolean] | undefined,
  );

  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur-lg">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Vault Health</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6">
        <HealthScore score={metrics.score} size={120} />

        <div className="h-px w-full bg-border/50" />

        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Collateral Ratio
            </span>
            <Badge className={getBadgeClass("collateral", metrics.collateralRatio)}>
              {metrics.collateralRatio.toFixed(1)}%
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Utilization Rate
            </span>
            <Badge className={getBadgeClass("utilization", metrics.utilizationRate)}>
              {metrics.utilizationRate.toFixed(1)}%
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Active Alerts
            </span>
            <Badge className={getBadgeClass("alerts", metrics.alerts)}>
              {metrics.alerts}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
