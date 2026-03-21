"use client";

import { useReadContracts } from "wagmi";
import { formatUnits, formatEther } from "viem";
import { useApp } from "@/providers/app-provider";
import { BASE_aUSDC, AAVE_POOL } from "@/lib/contracts/addresses";
import {
  Card,
  CardContent,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view" as const,
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const AAVE_POOL_ABI = [
  {
    name: "getUserAccountData",
    type: "function",
    stateMutability: "view" as const,
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" },
    ],
  },
] as const;

export function AavePosition() {
  const { activeAddress } = useApp();

  const { data, isLoading } = useReadContracts({
    contracts: [
      {
        address: BASE_aUSDC,
        abi: ERC20_BALANCE_ABI,
        functionName: "balanceOf",
        args: [activeAddress as `0x${string}`],
      },
      {
        address: AAVE_POOL,
        abi: AAVE_POOL_ABI,
        functionName: "getUserAccountData",
        args: [activeAddress as `0x${string}`],
      },
    ],
    query: {
      enabled: !!activeAddress,
      refetchInterval: 5_000,
    },
  });

  const aBalance = data?.[0]?.result as bigint | undefined;
  const accountData = data?.[1]?.result as
    | [bigint, bigint, bigint, bigint, bigint, bigint]
    | undefined;

  const hasPosition = aBalance !== undefined && aBalance > 0n;

  if (isLoading || !hasPosition) return null;

  const formattedBalance = Number(formatUnits(aBalance, 6)).toFixed(2);
  const totalCollateral = accountData
    ? Number(formatEther(accountData[0])).toFixed(2)
    : "0.00";
  const totalDebt = accountData
    ? Number(formatEther(accountData[1])).toFixed(2)
    : "0.00";
  const healthFactor =
    accountData && accountData[1] > 0n
      ? (Number(accountData[5]) / 1e18).toFixed(2)
      : null;

  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur-lg">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-lg font-semibold">Aave V3 Position</CardTitle>
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            Lending
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted-foreground">
              Supplied
            </span>
            <span className="text-lg font-semibold">
              {formattedBalance}
            </span>
            <span className="text-xs text-muted-foreground">aUSDC</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted-foreground">
              Collateral
            </span>
            <span className="text-lg font-semibold">
              ${totalCollateral}
            </span>
            <span className="text-xs text-muted-foreground">USD</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted-foreground">
              Debt
            </span>
            <span className="text-lg font-semibold">
              ${totalDebt}
            </span>
            <span className="text-xs text-muted-foreground">USD</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted-foreground">
              Health Factor
            </span>
            <span className="text-lg font-semibold">
              {healthFactor ?? "N/A"}
            </span>
            <span className="text-xs text-muted-foreground">
              {healthFactor ? "" : "No debt"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
