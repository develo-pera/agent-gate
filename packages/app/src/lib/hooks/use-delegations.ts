"use client";

import { useReadContracts } from "wagmi";
import { formatEther, type Address } from "viem";
import { keepPreviousData } from "@tanstack/react-query";
import { useApp } from "@/providers/app-provider";
import { TREASURY_ABI } from "@/lib/contracts/treasury-abi";
import { TREASURY_ADDRESS } from "@/lib/contracts/addresses";
import { AGENT_ADDRESSES } from "@/lib/contracts/addresses";

const POLL_INTERVAL = 5_000;

const ALL_AGENTS = Object.entries(AGENT_ADDRESSES) as [string, Address][];

export interface SpenderDelegation {
  id: string;
  owner: Address;
  ownerName: string;
  spender: Address;
  spenderName: string;
  authorized: boolean;
  yieldOnly: boolean;
  maxPerTx: string;
  spentInWindow: string;
  windowDuration: number;
  windowAllowance: string;
  /** "granted" = I am the depositor, "received" = I am the spender */
  direction: "granted" | "received";
}

export function useDelegations() {
  const { activeAddress } = useApp();
  const activeLower = activeAddress?.toLowerCase();

  // Build queries: for each agent pair where activeAddress is involved,
  // query getSpenderConfig(owner, spender)
  const queries: { owner: string; ownerName: string; spender: Address; spenderName: string }[] = [];

  for (const [nameA, addrA] of ALL_AGENTS) {
    for (const [nameB, addrB] of ALL_AGENTS) {
      if (addrA.toLowerCase() === addrB.toLowerCase()) continue;
      // Only include if activeAddress is the owner or the spender
      if (addrA.toLowerCase() === activeLower || addrB.toLowerCase() === activeLower) {
        // owner = addrA, spender = addrB
        queries.push({ owner: addrA, ownerName: nameA, spender: addrB, spenderName: nameB });
      }
    }
  }

  // Deduplicate (each pair only once)
  const seen = new Set<string>();
  const uniqueQueries = queries.filter((q) => {
    const key = `${q.owner.toLowerCase()}-${q.spender.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const contracts = uniqueQueries.map((q) => ({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: "getSpenderConfig" as const,
    args: [q.owner as Address, q.spender],
  }));

  const { data, isLoading } = useReadContracts({
    contracts,
    query: {
      enabled: !!activeAddress,
      refetchInterval: POLL_INTERVAL,
      placeholderData: keepPreviousData,
    },
  });

  const delegations: SpenderDelegation[] = [];

  if (data) {
    data.forEach((result, i) => {
      if (result.status !== "success" || !result.result) return;
      const [authorized, yieldOnly, maxPerTx, spentInWindow, , windowDuration, windowAllowance] =
        result.result as [boolean, boolean, bigint, bigint, number, number, bigint];

      if (!authorized) return;

      const q = uniqueQueries[i];
      if (!q) return;
      const direction =
        q.owner.toLowerCase() === activeLower ? "granted" : "received";

      delegations.push({
        id: `${q.owner}-${q.spender}`,
        owner: q.owner as Address,
        ownerName: q.ownerName,
        spender: q.spender,
        spenderName: q.spenderName,
        authorized,
        yieldOnly,
        maxPerTx: formatEther(maxPerTx),
        spentInWindow: formatEther(spentInWindow),
        windowDuration,
        windowAllowance: formatEther(windowAllowance),
        direction,
      });
    });
  }

  return { delegations, isLoading };
}
