"use client";

import { useState } from "react";

export interface Delegation {
  id: string;
  delegate: string;
  scope: string;
  caveats: { maxAmount: string; token: string };
  status: "active" | "expired";
  createdAt: string;
}

export function useDelegations() {
  const [sessionDelegations, setSessionDelegations] = useState<Delegation[]>(
    [],
  );

  return { delegations: sessionDelegations, setSessionDelegations };
}
