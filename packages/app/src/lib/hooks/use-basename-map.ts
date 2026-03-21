"use client";

import { useReadContracts } from "wagmi";
import { AGENT_ADDRESSES } from "@/lib/contracts/addresses";

const REVERSE_REGISTRAR = "0x79ea96012eea67a83431f1701b3dff7e37f9e282";
const L2_RESOLVER = "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD";

const REVERSE_REGISTRAR_ABI = [
  {
    name: "node",
    type: "function",
    stateMutability: "pure" as const,
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

const L2_RESOLVER_ABI = [
  {
    name: "name",
    type: "function",
    stateMutability: "view" as const,
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

const ADDRESSES = Object.values(AGENT_ADDRESSES);

/**
 * Resolves basenames for all known agent addresses in a single multicall.
 * Returns a lookup function: address → basename | null
 */
export function useBasenameMap(): (addr: string) => string | null {
  // Step 1: get reverse nodes for all agent addresses
  const { data: nodes } = useReadContracts({
    contracts: ADDRESSES.map((addr) => ({
      address: REVERSE_REGISTRAR as `0x${string}`,
      abi: REVERSE_REGISTRAR_ABI,
      functionName: "node" as const,
      args: [addr],
    })),
  });

  // Step 2: resolve names from nodes
  const nodeResults = nodes?.map((r) => r.result as `0x${string}` | undefined) ?? [];

  const { data: names } = useReadContracts({
    contracts: nodeResults.map((node) => ({
      address: L2_RESOLVER as `0x${string}`,
      abi: L2_RESOLVER_ABI,
      functionName: "name" as const,
      args: [node ?? ("0x" + "00".repeat(32)) as `0x${string}`],
    })),
    query: { enabled: nodeResults.some(Boolean) },
  });

  // Build lookup map
  const map = new Map<string, string>();
  ADDRESSES.forEach((addr, i) => {
    const name = names?.[i]?.result as string | undefined;
    if (name) map.set(addr.toLowerCase(), name);
  });

  return (addr: string) => map.get(addr.toLowerCase()) ?? null;
}
