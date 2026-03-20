"use client";

import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { useApp } from "@/providers/app-provider";
import { WSTETH_ABI } from "@/lib/contracts/lido-abi";
import { BASE_WSTETH } from "@/lib/contracts/addresses";

export function useLidoApr() {
  return useQuery({
    queryKey: ["lido-apr"],
    queryFn: async () => {
      const res = await fetch("/api/lido/apr");
      if (!res.ok) throw new Error("Failed to fetch APR");
      return res.json() as Promise<{ apr: number; source: string }>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useWstethBalance() {
  const { activeAddress } = useApp();
  return useReadContract({
    address: BASE_WSTETH,
    abi: WSTETH_ABI,
    functionName: "balanceOf",
    args: [activeAddress as `0x${string}`],
  });
}
