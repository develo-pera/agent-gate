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
  spender: Address;
  spenderName: string;
  authorized: boolean;
  yieldOnly: boolean;
  maxPerTx: string;
  spentInWindow: string;
  windowDuration: number;
  windowAllowance: string;
}

export function useDelegations() {
  const { activeAddress } = useApp();

  // Query getSpenderConfig for every known agent against the active address
  const contracts = ALL_AGENTS
    .filter(([, addr]) => addr.toLowerCase() !== activeAddress?.toLowerCase())
    .map(([, spenderAddr]) => ({
      address: TREASURY_ADDRESS,
      abi: TREASURY_ABI,
      functionName: "getSpenderConfig" as const,
      args: [activeAddress as Address, spenderAddr],
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
    const otherAgents = ALL_AGENTS.filter(
      ([, addr]) => addr.toLowerCase() !== activeAddress?.toLowerCase(),
    );

    data.forEach((result, i) => {
      if (result.status !== "success" || !result.result) return;
      const [authorized, yieldOnly, maxPerTx, spentInWindow, , windowDuration, windowAllowance] =
        result.result as [boolean, boolean, bigint, bigint, number, number, bigint];

      if (!authorized) return;

      const [name, addr] = otherAgents[i];
      delegations.push({
        id: `${activeAddress}-${addr}`,
        spender: addr,
        spenderName: name,
        authorized,
        yieldOnly,
        maxPerTx: formatEther(maxPerTx),
        spentInWindow: formatEther(spentInWindow),
        windowDuration,
        windowAllowance: formatEther(windowAllowance),
      });
    });
  }

  return { delegations, isLoading };
}
