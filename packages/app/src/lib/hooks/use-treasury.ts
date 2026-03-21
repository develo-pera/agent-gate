import { useReadContract } from "wagmi";
import { keepPreviousData } from "@tanstack/react-query";
import { TREASURY_ABI } from "@/lib/contracts/treasury-abi";
import { TREASURY_ADDRESS } from "@/lib/contracts/addresses";
import { useApp } from "@/providers/app-provider";

const POLL_INTERVAL = 5_000;

export function useVaultStatus() {
  const { activeAddress, isDemo } = useApp();
  return useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: "getVaultStatus",
    args: [activeAddress as `0x${string}`],
    query: {
      enabled: !isDemo,
      refetchInterval: POLL_INTERVAL,
    },
  });
}

export function useOracleRate() {
  return useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: "getCurrentRate",
    query: { refetchInterval: POLL_INTERVAL, placeholderData: keepPreviousData },
  });
}
