"use client";

import { useReadContract } from "wagmi";

const REVERSE_REGISTRAR = "0x79ea96012eea67a83431f1701b3dff7e37f9e282";
const L2_RESOLVER = "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD";

const REVERSE_REGISTRAR_ABI = [
  {
    name: "node",
    type: "function",
    stateMutability: "pure",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

const L2_RESOLVER_ABI = [
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

export function useBasename(address: string | undefined) {
  const { data: node } = useReadContract({
    address: REVERSE_REGISTRAR as `0x${string}`,
    abi: REVERSE_REGISTRAR_ABI,
    functionName: "node",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address },
  });

  const { data: name } = useReadContract({
    address: L2_RESOLVER as `0x${string}`,
    abi: L2_RESOLVER_ABI,
    functionName: "name",
    args: node ? [node] : undefined,
    query: { enabled: !!node },
  });

  return name || null;
}
