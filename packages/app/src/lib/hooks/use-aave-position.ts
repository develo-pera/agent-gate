"use client";

import { useReadContract } from "wagmi";
import { useApp } from "@/providers/app-provider";
import { BASE_aUSDC } from "@/lib/contracts/addresses";

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view" as const,
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export function useHasAavePosition() {
  const { activeAddress } = useApp();

  const { data } = useReadContract({
    address: BASE_aUSDC,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: [activeAddress as `0x${string}`],
    query: {
      enabled: !!activeAddress,
      refetchInterval: 5_000,
    },
  });

  const balance = data as bigint | undefined;
  return balance !== undefined && balance > 0n;
}
