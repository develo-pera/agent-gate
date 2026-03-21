"use client";

import { useRef } from "react";
import { useVaultStatus, useOracleRate } from "@/lib/hooks/use-treasury";
import { ErrorCard } from "@/components/shared/error-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardTitle,
} from "@/components/ui/card";
import { formatWsteth, formatRate } from "@/lib/format";
import { useApp } from "@/providers/app-provider";
import { useBasename } from "@/lib/hooks/use-basename";
import { Badge } from "@/components/ui/badge";
import { DEMO_TREASURY_ADDRESS } from "@/lib/constants";

export function VaultOverview() {
  const { activeAddress, viewAddress } = useApp();
  const basename = useBasename(activeAddress);
  const {
    data: vaultData,
    isLoading: vaultLoading,
    error: vaultError,
    refetch: refetchVault,
  } = useVaultStatus();
  const { data: rateData, isLoading: rateLoading } = useOracleRate();

  const hasResolved = useRef(false);
  if (vaultData !== undefined || vaultError) hasResolved.current = true;

  if (!hasResolved.current && (vaultLoading || rateLoading)) {
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

  const [depositedPrincipal, rawYield, totalBalance, hasVault] =
    (vaultData as [bigint, bigint, bigint, boolean] | undefined) ?? [
      BigInt(0),
      BigInt(0),
      BigInt(0),
      false,
    ];

  // When viewing your own vault, show your available yield
  const isOwnVault = !viewAddress || activeAddress.toLowerCase() !== DEMO_TREASURY_ADDRESS.toLowerCase();
  const availableYield = isOwnVault ? rawYield : BigInt(0);

  if (!hasVault) {
    return (
      <Card className="border-border/50 bg-card/60 backdrop-blur-lg">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <CardTitle className="text-xl font-semibold">
            No Vault Deposits Yet
          </CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            No wstETH has been deposited into the treasury vault yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Overall APY uses raw yield (not viewer-scoped)
  const apyPct =
    depositedPrincipal > BigInt(0)
      ? ((Number(rawYield) / Number(depositedPrincipal)) * 100).toFixed(2)
      : "0.00";

  const yieldPct =
    depositedPrincipal > BigInt(0)
      ? ((Number(availableYield) / Number(depositedPrincipal)) * 100).toFixed(2)
      : "0.00";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">Vault Overview</h2>
        {basename && (
          <Badge variant="secondary" className="text-sm font-mono">
            {basename}
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-1 gap-px rounded-xl border border-border/50 bg-border/50 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-l-xl bg-card/80 p-5">
          <span className="text-sm text-muted-foreground">Your Principal</span>
          <span className="text-2xl font-semibold">
            {formatWsteth(depositedPrincipal)} wstETH
          </span>
          <span className="text-xs text-muted-foreground">
            Chainlink: 1 wstETH = {formatRate(rateData as bigint | undefined)} stETH
          </span>
        </div>
        <div className="flex flex-col gap-1 bg-card/80 p-5">
          <span className="text-sm text-muted-foreground">Your Total Balance</span>
          <span className="text-2xl font-semibold">
            {formatWsteth(totalBalance)} wstETH
          </span>
          <span className="text-xs text-emerald-400">
            ▲ {apyPct}% APY
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-r-xl bg-card/80 p-5">
          <span className="text-sm text-muted-foreground">Your Available Yield</span>
          <span className="text-2xl font-semibold text-primary [text-shadow:0_0_20px_hsl(319_100%_61%/0.5)]">
            {formatWsteth(availableYield)} wstETH
          </span>
          <span className="text-xs text-emerald-400">
            ▲ {yieldPct}% of principal
          </span>
        </div>
      </div>
    </div>
  );
}
