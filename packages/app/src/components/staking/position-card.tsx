"use client";

import { useWstethBalance } from "@/lib/hooks/use-staking";
import { useVaultStatus, useOracleRate } from "@/lib/hooks/use-treasury";
import { useApp } from "@/providers/app-provider";
import { ErrorCard } from "@/components/shared/error-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatWsteth } from "@/lib/format";
import { formatEther } from "viem";
import { DEMO_TREASURY_ADDRESS } from "@/lib/constants";

export function PositionCard() {
  const { activeAddress, viewAddress } = useApp();
  const {
    data: wstethBalance,
    isLoading: balanceLoading,
    error: balanceError,
    refetch,
  } = useWstethBalance();
  const { data: vaultData } = useVaultStatus();
  const { data: oracleRate } = useOracleRate();

  if (balanceLoading) {
    return <Skeleton className="h-[280px] rounded-xl" />;
  }

  if (balanceError) {
    return (
      <ErrorCard
        message="Failed to load staking data."
        onRetry={refetch}
      />
    );
  }

  // Show vault data when viewing your own vault
  const isDepositor = !viewAddress || activeAddress.toLowerCase() !== DEMO_TREASURY_ADDRESS.toLowerCase();

  const [principal, availableYield, totalBalance, hasVault] =
    (vaultData as [bigint, bigint, bigint, boolean] | undefined) ?? [
      BigInt(0), BigInt(0), BigInt(0), false,
    ];

  const walletBalance = wstethBalance ?? BigInt(0);
  const rateNum = oracleRate ? Number(formatEther(oracleRate as bigint)) : null;

  const showVault = isDepositor && hasVault;
  const totalWsteth = walletBalance + (showVault ? totalBalance : BigInt(0));
  const totalSteth = rateNum
    ? (Number(formatEther(totalWsteth)) * rateNum).toFixed(4)
    : null;

  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur-lg">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Staking Position
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Total holdings */}
        <div>
          <span className="text-xs text-muted-foreground">Total wstETH</span>
          <p className="text-3xl font-semibold">
            {formatWsteth(totalWsteth)}
          </p>
          {totalSteth && (
            <p className="text-sm text-muted-foreground">
              = {totalSteth} stETH
            </p>
          )}
        </div>

        <div className="h-px w-full bg-border/50" />

        {/* Breakdown */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">In vault (principal)</span>
            <span className="text-sm font-medium">
              {showVault ? `${formatWsteth(principal)} wstETH` : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Accrued yield</span>
            <span className="text-sm font-medium text-primary">
              {showVault ? `${formatWsteth(availableYield)} wstETH` : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Wallet balance</span>
            <span className="text-sm font-medium">
              {formatWsteth(walletBalance)} wstETH
            </span>
          </div>
        </div>

        {rateNum && (
          <>
            <div className="h-px w-full bg-border/50" />
            <p className="text-xs text-muted-foreground">
              Exchange rate: 1 wstETH = {rateNum.toFixed(4)} stETH (Chainlink)
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
