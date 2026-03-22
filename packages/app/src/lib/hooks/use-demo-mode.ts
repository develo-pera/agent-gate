"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ActivityEvent } from "@agentgate/mcp-server/activity-log";
import type { AgentInfo } from "./use-agents";

interface DemoStep {
  agentIndex: number;
  toolName: string;
  status: "pending" | "success" | "error";
  params: Record<string, unknown>;
  result: unknown | null;
  durationMs: number | null;
  txHash: string | null;
  txStatus: string | null;
  blockNumber: string | null;
}

const DEMO_SEQUENCE: DemoStep[] = [
  // Agent 0 checks vault health
  { agentIndex: 0, toolName: "vault_health", status: "pending", params: {}, result: null, durationMs: null, txHash: null, txStatus: null, blockNumber: null },
  { agentIndex: 0, toolName: "vault_health", status: "success", params: {}, result: { health: 0.95, collateralRatio: 1.85 }, durationMs: 120, txHash: null, txStatus: null, blockNumber: null },
  // Agent 1 checks wstETH balance
  { agentIndex: 1, toolName: "get_wsteth_balance", status: "pending", params: { address: "0x7a25...treasury" }, result: null, durationMs: null, txHash: null, txStatus: null, blockNumber: null },
  { agentIndex: 1, toolName: "get_wsteth_balance", status: "success", params: { address: "0x7a25...treasury" }, result: { balance: "2.5 wstETH" }, durationMs: 85, txHash: null, txStatus: null, blockNumber: null },
  // Agent 0 deposits to vault
  { agentIndex: 0, toolName: "deposit_to_vault", status: "pending", params: { amount: "1.0", token: "wstETH" }, result: null, durationMs: null, txHash: null, txStatus: null, blockNumber: null },
  { agentIndex: 0, toolName: "deposit_to_vault", status: "success", params: { amount: "1.0", token: "wstETH" }, result: { deposited: "1.0 wstETH" }, durationMs: 3200, txHash: "0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890", txStatus: "confirmed", blockNumber: "12345678" },
  // Agent 1 checks delegations
  { agentIndex: 1, toolName: "list_delegations", status: "pending", params: {}, result: null, durationMs: null, txHash: null, txStatus: null, blockNumber: null },
  { agentIndex: 1, toolName: "list_delegations", status: "success", params: {}, result: { delegations: 3, total: "5.2 ETH" }, durationMs: 95, txHash: null, txStatus: null, blockNumber: null },
  // Agent 0 stakes
  { agentIndex: 0, toolName: "stake_eth", status: "pending", params: { amount: "0.5" }, result: null, durationMs: null, txHash: null, txStatus: null, blockNumber: null },
  { agentIndex: 0, toolName: "stake_eth", status: "success", params: { amount: "0.5" }, result: { staked: "0.5 ETH", received: "0.43 wstETH" }, durationMs: 4100, txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab", txStatus: "confirmed", blockNumber: "12345680" },
  // Agent 1 checks vault health after activity
  { agentIndex: 1, toolName: "vault_health", status: "pending", params: {}, result: null, durationMs: null, txHash: null, txStatus: null, blockNumber: null },
  { agentIndex: 1, toolName: "vault_health", status: "success", params: {}, result: { health: 0.97, collateralRatio: 1.92 }, durationMs: 110, txHash: null, txStatus: null, blockNumber: null },
];

export function useDemoMode(agents: AgentInfo[]) {
  const [demoEvents, setDemoEvents] = useState<ActivityEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const nextIdRef = useRef(10000);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startDemo = useCallback(() => {
    if (agents.length === 0 || isRunning) return;

    setIsRunning(true);
    let index = 0;

    intervalRef.current = setInterval(() => {
      if (index >= DEMO_SEQUENCE.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }

      const step = DEMO_SEQUENCE[index];
      const agent = agents[step.agentIndex % agents.length];

      const event: ActivityEvent = {
        id: nextIdRef.current++,
        agentId: agent.agent_id,
        agentAddress: agent.address,
        toolName: step.toolName,
        params: step.params,
        result: step.result,
        status: step.status,
        timestamp: Date.now(),
        durationMs: step.durationMs,
        txHash: step.txHash,
        txStatus: step.txStatus,
        blockNumber: step.blockNumber,
      };

      setDemoEvents((prev) => [event, ...prev]);
      index++;
    }, 2500);
  }, [agents, isRunning]);

  const stopDemo = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    setDemoEvents([]);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { demoEvents, isRunning, startDemo, stopDemo };
}
