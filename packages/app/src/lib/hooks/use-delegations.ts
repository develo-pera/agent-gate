"use client";

import { useState, useCallback } from "react";
import { useApp } from "@/providers/app-provider";

export interface Delegation {
  id: string;
  delegate: string;
  scope: string;
  caveats: { maxAmount: string; token: string };
  status: "active" | "expired";
  createdAt: string;
}

const DEMO_DELEGATIONS: Delegation[] = [
  {
    id: "1",
    delegate: "0x1234567890abcdef1234567890abcdef12345678",
    scope: "yield_withdrawal",
    caveats: { maxAmount: "1.5", token: "wstETH" },
    status: "active",
    createdAt: new Date().toISOString(),
  },
  {
    id: "2",
    delegate: "0xabcdef1234567890abcdef1234567890abcdef12",
    scope: "full_access",
    caveats: { maxAmount: "10.0", token: "wstETH" },
    status: "expired",
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
];

export function useDelegations() {
  const { isDemo } = useApp();
  const [sessionDelegations, setSessionDelegations] = useState<Delegation[]>(
    [],
  );

  const delegations = isDemo
    ? [...DEMO_DELEGATIONS, ...sessionDelegations]
    : sessionDelegations;

  return { delegations, setSessionDelegations };
}

export function useDelegationActions() {
  const [delegations, setDelegations] = useState<Delegation[]>([]);

  const addDelegation = useCallback(
    (delegation: Omit<Delegation, "id" | "createdAt">) => {
      const newDelegation: Delegation = {
        ...delegation,
        id: `del_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setDelegations((prev) => [...prev, newDelegation]);
      return newDelegation;
    },
    [],
  );

  const removeDelegation = useCallback((id: string) => {
    setDelegations((prev) => prev.filter((d) => d.id !== id));
  }, []);

  return { delegations, addDelegation, removeDelegation };
}
