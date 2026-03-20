"use client";

import { formatEther } from "viem";
import { useVaultStatus, useOracleRate } from "@/lib/hooks/use-treasury";
import { DonutChart } from "@/components/shared/donut-chart";
import { StatCard } from "@/components/shared/stat-card";
import { ErrorCard } from "@/components/shared/error-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { formatWsteth, formatRate } from "@/lib/format";

export function VaultOverview() {
  const {
    data: vaultData,
    isLoading: vaultLoading,
    error: vaultError,
    refetch: refetchVault,
  } = useVaultStatus();
  const { data: rateData, isLoading: rateLoading } = useOracleRate();

  if (vaultLoading || rateLoading) {
    return <Skeleton className="h-[200px] rounded-xl" />;
  }

  if (vaultError) {
    return (
      <ErrorCard
        message="Failed to load vault data. Check your connection and try again."
        onRetry={() => refetchVault()}
      />
    );
  }

  const [depositedPrincipal, availableYield, totalBalance, hasVault] =
    (vaultData as [bigint, bigint, bigint, boolean] | undefined) ?? [
      BigInt(0),
      BigInt(0),
      BigInt(0),
      false,
    ];

  if (!hasVault) {
    return (
      <Card className="border-border/50 bg-card/60 backdrop-blur-lg">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <CardTitle className="text-xl font-semibold">
            No Vault Position
          </CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect your wallet to view vault balances, or browse in demo mode
            with sample data.
          </p>
        </CardContent>
      </Card>
    );
  }

  const principalNum = Number(formatEther(depositedPrincipal));
  const yieldNum = Number(formatEther(availableYield));

  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Vault Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-row items-center gap-8">
          <DonutChart principal={principalNum} yieldAmount={yieldNum} size={200} />
          <div className="flex flex-col gap-4">
            <StatCard
              label="Principal"
              value={`${formatWsteth(depositedPrincipal)} wstETH`}
            />
            <StatCard
              label="Yield"
              value={`${formatWsteth(availableYield)} wstETH`}
              glow
            />
            <StatCard
              label="Total"
              value={`${formatWsteth(totalBalance)} wstETH`}
            />
            <p className="text-xs text-muted-foreground">
              1 wstETH = {formatRate(rateData as bigint | undefined)} stETH (Chainlink)
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
