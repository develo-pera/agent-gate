"use client";

import { useWstethBalance } from "@/lib/hooks/use-staking";
import { useOracleRate } from "@/lib/hooks/use-treasury";
import { StatCard } from "@/components/shared/stat-card";
import { ErrorCard } from "@/components/shared/error-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatWsteth, formatUsd } from "@/lib/format";
import { formatEther } from "viem";

export function PositionCard() {
  const {
    data: wstethBalance,
    isLoading: balanceLoading,
    error: balanceError,
    refetch,
  } = useWstethBalance();
  const { data: oracleRate } = useOracleRate();

  if (balanceLoading) {
    return <Skeleton className="h-[200px] rounded-xl" />;
  }

  if (balanceError) {
    return (
      <ErrorCard
        message="Failed to load staking data. Check your connection and try again."
        onRetry={refetch}
      />
    );
  }

  // Empty state: no balance
  const isEmpty =
    wstethBalance === undefined || wstethBalance === BigInt(0);

  if (isEmpty) {
    return (
      <Card className="border-border/50 bg-card/60 backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            No Staking Position
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No wstETH or stETH found for this address. Stake ETH on Lido to get
            started.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Compute stETH equivalent from wstETH balance and oracle rate
  const wstethNum = Number(formatEther(wstethBalance));
  const stethEquiv =
    oracleRate !== undefined
      ? (wstethNum * Number(formatEther(oracleRate))).toFixed(4)
      : "\u2014";

  // Approximate USD value (hackathon estimate -- no live price feed)
  const stethEquivNum =
    oracleRate !== undefined
      ? wstethNum * Number(formatEther(oracleRate))
      : undefined;
  const usdValue =
    stethEquivNum !== undefined ? stethEquivNum * 2400 : undefined;

  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur-lg">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Staking Position
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <StatCard
          label="wstETH Balance"
          value={formatWsteth(wstethBalance)}
          subValue={`= ${stethEquiv} stETH`}
        />
        <p className="text-sm text-muted-foreground">
          ~{formatUsd(usdValue)} USD
        </p>
      </CardContent>
    </Card>
  );
}
