import { useReadContract } from "wagmi";
import { keepPreviousData } from "@tanstack/react-query";
import { TREASURY_ABI } from "@/lib/contracts/treasury-abi";
import { TREASURY_ADDRESS } from "@/lib/contracts/addresses";
import { DEMO_TREASURY_ADDRESS } from "@/lib/constants";

const POLL_INTERVAL = 5_000;

export function useVaultStatus() {
  return useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: "getVaultStatus",
    args: [DEMO_TREASURY_ADDRESS as `0x${string}`],
    query: { refetchInterval: POLL_INTERVAL, placeholderData: keepPreviousData },
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
