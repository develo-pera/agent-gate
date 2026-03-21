"use client";

import { useVaultStatus } from "@/lib/hooks/use-treasury";
import { useDelegations } from "@/lib/hooks/use-delegations";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorCard } from "@/components/shared/error-card";
import { formatEther } from "viem";
import { Shield, Users, TrendingUp, Lock } from "lucide-react";

export function HealthReport() {
  const { data: vaultData, isLoading, error, refetch } = useVaultStatus();
  const { delegations } = useDelegations();

  if (isLoading) {
    return <Skeleton className="h-[280px] rounded-xl" />;
  }

  if (error) {
    return (
      <ErrorCard
        message="Failed to load vault data."
        onRetry={refetch}
      />
    );
  }

  const [principal, availableYield, totalBalance, hasVault] =
    (vaultData as [bigint, bigint, bigint, boolean] | undefined) ?? [
      BigInt(0), BigInt(0), BigInt(0), false,
    ];

  const yieldPct = hasVault && principal > BigInt(0)
    ? ((Number(availableYield) / Number(principal)) * 100).toFixed(2)
    : "0.00";

  const activeSpenders = delegations.length;

  // Total daily exposure: sum of all spender daily caps
  const totalDailyExposure = delegations.reduce(
    (sum, d) => sum + Number(d.windowAllowance), 0,
  );

  const yieldNum = hasVault ? Number(formatEther(availableYield)) : 0;
  const exposureVsYield = yieldNum > 0 && totalDailyExposure > 0
    ? ((totalDailyExposure / yieldNum) * 100).toFixed(0)
    : null;

  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur-lg">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Vault Health</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Principal protection */}
        <div className="flex items-center gap-3">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-1 items-center justify-between">
            <span className="text-sm">Principal protected</span>
            <Badge className="bg-success/20 text-success border-success/30">
              {hasVault ? "Yes" : "No vault"}
            </Badge>
          </div>
        </div>

        {/* Yield health */}
        <div className="flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-1 items-center justify-between">
            <span className="text-sm">Yield accrued</span>
            <Badge className={
              Number(yieldPct) > 0
                ? "bg-success/20 text-success border-success/30"
                : "bg-muted text-muted-foreground"
            }>
              {yieldPct}%
            </Badge>
          </div>
        </div>

        {/* Active spenders */}
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-1 items-center justify-between">
            <span className="text-sm">Authorized spenders</span>
            <Badge className={
              activeSpenders === 0
                ? "bg-success/20 text-success border-success/30"
                : "bg-warning/20 text-warning border-warning/30"
            }>
              {activeSpenders}
            </Badge>
          </div>
        </div>

        {/* Exposure */}
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-1 items-center justify-between">
            <span className="text-sm">Daily exposure</span>
            <Badge className={
              totalDailyExposure === 0
                ? "bg-success/20 text-success border-success/30"
                : exposureVsYield && Number(exposureVsYield) > 100
                  ? "bg-destructive/20 text-destructive border-destructive/30"
                  : "bg-warning/20 text-warning border-warning/30"
            }>
              {totalDailyExposure > 0
                ? `${totalDailyExposure.toFixed(4)} wstETH/day`
                : "None"}
            </Badge>
          </div>
        </div>

        <div className="h-px w-full bg-border/50" />

        {/* Summary */}
        {activeSpenders > 0 && exposureVsYield ? (
          <p className="text-xs text-muted-foreground">
            Spenders can withdraw up to {exposureVsYield}% of your available
            yield per day. Principal is always locked and cannot be touched.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            No spenders authorized. Your vault principal and yield are fully
            protected.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
