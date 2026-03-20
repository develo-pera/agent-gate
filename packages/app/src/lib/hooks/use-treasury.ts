import { useReadContract } from "wagmi";
import { useApp } from "@/providers/app-provider";
import { TREASURY_ABI } from "@/lib/contracts/treasury-abi";
import { TREASURY_ADDRESS } from "@/lib/contracts/addresses";

export function useVaultStatus() {
  const { activeAddress } = useApp();
  return useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: "getVaultStatus",
    args: [activeAddress as `0x${string}`],
  });
}

export function useOracleRate() {
  return useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: "getCurrentRate",
  });
}
