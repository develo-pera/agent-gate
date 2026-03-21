"use client";

import { useWatchContractEvent } from "wagmi";
import { formatEther, formatUnits, type Log } from "viem";
import { toast } from "sonner";
import { TREASURY_ABI } from "@/lib/contracts/treasury-abi";
import {
  TREASURY_ADDRESS,
  BASE_WSTETH,
  BASE_USDC,
  AGENT_ADDRESSES,
} from "@/lib/contracts/addresses";

const ERC20_TRANSFER_ABI = [
  {
    name: "Transfer",
    type: "event",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

const AGENT_SET = new Set(
  Object.values(AGENT_ADDRESSES).map((a) => a.toLowerCase()),
);

function isAgent(addr: string) {
  return AGENT_SET.has(addr.toLowerCase());
}

function agentName(addr: string) {
  const lower = addr.toLowerCase();
  if (lower === AGENT_ADDRESSES.hackaclaw.toLowerCase()) return "Hackaclaw";
  if (lower === AGENT_ADDRESSES.merkle.toLowerCase()) return "Merkle";
  return short(addr);
}

function short(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatAmount(val: bigint) {
  return Number(formatEther(val)).toFixed(6);
}

function txLink(log: Log) {
  return log.transactionHash
    ? `Tx: ${log.transactionHash.slice(0, 10)}...${log.transactionHash.slice(-6)}`
    : "";
}

export function useTxNotifications() {
  useWatchContractEvent({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    eventName: "Deposited",
    onLogs(logs) {
      for (const log of logs) {
        const { agent, wstETHAmount } = log.args as {
          agent: string;
          wstETHAmount: bigint;
        };
        toast.success("Deposit", {
          description: `${short(agent)} deposited ${formatAmount(wstETHAmount)} wstETH\n${txLink(log)}`,
          duration: 8000,
        });
      }
    },
    poll: true,
    pollingInterval: 4_000,
  });

  useWatchContractEvent({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    eventName: "YieldWithdrawn",
    onLogs(logs) {
      for (const log of logs) {
        const { agent, recipient, wstETHAmount } = log.args as {
          agent: string;
          recipient: string;
          wstETHAmount: bigint;
        };
        toast.info("Yield Withdrawn", {
          description: `${formatAmount(wstETHAmount)} wstETH from ${short(agent)} to ${short(recipient)}\n${txLink(log)}`,
          duration: 8000,
        });
      }
    },
    poll: true,
    pollingInterval: 4_000,
  });

  useWatchContractEvent({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    eventName: "SpenderAuthorized",
    onLogs(logs) {
      for (const log of logs) {
        const { agent, spender, maxPerTx } = log.args as {
          agent: string;
          spender: string;
          maxPerTx: bigint;
        };
        toast.success("Spender Authorized", {
          description: `${short(agent)} authorized ${short(spender)} (max ${formatAmount(maxPerTx)}/tx)\n${txLink(log)}`,
          duration: 8000,
        });
      }
    },
    poll: true,
    pollingInterval: 4_000,
  });

  useWatchContractEvent({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    eventName: "SpenderRevoked",
    onLogs(logs) {
      for (const log of logs) {
        const { agent, spender } = log.args as {
          agent: string;
          spender: string;
        };
        toast.warning("Spender Revoked", {
          description: `${short(agent)} revoked ${short(spender)}\n${txLink(log)}`,
          duration: 8000,
        });
      }
    },
    poll: true,
    pollingInterval: 4_000,
  });

  useWatchContractEvent({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    eventName: "PrincipalWithdrawn",
    onLogs(logs) {
      for (const log of logs) {
        const { agent, wstETHAmount } = log.args as {
          agent: string;
          wstETHAmount: bigint;
        };
        toast.warning("Principal Withdrawn", {
          description: `${short(agent)} withdrew ${formatAmount(wstETHAmount)} wstETH principal\n${txLink(log)}`,
          duration: 8000,
        });
      }
    },
    poll: true,
    pollingInterval: 4_000,
  });

  // ── Uniswap swap detection via ERC-20 Transfer events ──

  // Watch wstETH transfers FROM agents (sell side of swap)
  useWatchContractEvent({
    address: BASE_WSTETH,
    abi: ERC20_TRANSFER_ABI,
    eventName: "Transfer",
    onLogs(logs) {
      for (const log of logs) {
        const { from, to, value } = log.args as {
          from: string;
          to: string;
          value: bigint;
        };
        // Only show if an agent is sending and recipient is NOT the treasury (that's a deposit, not a swap)
        if (
          isAgent(from) &&
          to.toLowerCase() !== TREASURY_ADDRESS.toLowerCase()
        ) {
          toast.info("Swap: wstETH sent", {
            description: `${agentName(from)} sent ${formatAmount(value)} wstETH\n${txLink(log)}`,
            duration: 8000,
          });
        }
      }
    },
    poll: true,
    pollingInterval: 4_000,
  });

  // Watch USDC transfers TO agents (buy side of swap)
  useWatchContractEvent({
    address: BASE_USDC,
    abi: ERC20_TRANSFER_ABI,
    eventName: "Transfer",
    onLogs(logs) {
      for (const log of logs) {
        const { to, value } = log.args as {
          from: string;
          to: string;
          value: bigint;
        };
        if (isAgent(to)) {
          const usdcAmount = Number(formatUnits(value, 6)).toFixed(2);
          toast.success("Swap: USDC received", {
            description: `${agentName(to)} received ${usdcAmount} USDC\n${txLink(log)}`,
            duration: 8000,
          });
        }
      }
    },
    poll: true,
    pollingInterval: 4_000,
  });
}
