"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useApp } from "@/providers/app-provider";
import { useBasename } from "@/lib/hooks/use-basename";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { BASE_USDC } from "@/lib/contracts/addresses";
import { Bot, ChevronDown, Power, ExternalLink, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

interface AgentInfo {
  agent_id: string;
  address: string;
}

const LS_KEY = "agentgate_connected_agent";
const POLL_INTERVAL = 10_000; // 10s

function shortenAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function AgentBasename({ address }: { address: string }) {
  const basename = useBasename(address);
  if (!basename) return null;
  return <span className="text-xs opacity-70 font-mono">{basename}</span>;
}

export function AgentWalletConnect() {
  const { setViewAddress } = useApp();
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [connectedAgent, setConnectedAgent] = useState<AgentInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const basename = useBasename(connectedAgent?.address);

  const { data: usdcBalance } = useReadContract({
    address: BASE_USDC,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: connectedAgent ? [connectedAgent.address as `0x${string}`] : undefined,
    query: {
      enabled: !!connectedAgent,
      refetchInterval: 5_000,
    },
  });

  const formattedUsdc = usdcBalance !== undefined
    ? Number(formatUnits(usdcBalance as bigint, 6)).toFixed(2)
    : null;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch agents + poll for updates
  useEffect(() => {
    function fetchAgents() {
      fetch("/api/agents")
        .then((r) => r.json())
        .then((data) => setAgents(data.agents || []))
        .catch(() => {});
    }
    fetchAgents();
    const interval = setInterval(fetchAgents, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Auto-reconnect from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (saved && agents.length > 0) {
      const agent = agents.find((a) => a.agent_id === saved);
      if (agent) {
        setConnectedAgent(agent);
        setViewAddress(agent.address);
      }
    }
  }, [agents, setViewAddress]);

  // Focus search when dropdown opens
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const connect = useCallback(
    (agent: AgentInfo) => {
      setConnectedAgent(agent);
      setViewAddress(agent.address);
      localStorage.setItem(LS_KEY, agent.agent_id);
      setOpen(false);
      setSearch("");
    },
    [setViewAddress],
  );

  const disconnect = useCallback(() => {
    setConnectedAgent(null);
    setViewAddress("");
    localStorage.removeItem(LS_KEY);
    setOpen(false);
    setSearch("");
  }, [setViewAddress]);

  // Filter agents by search query
  const filterAgents = (list: AgentInfo[]) => {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      (a) => a.agent_id.toLowerCase().includes(q) || a.address.toLowerCase().includes(q),
    );
  };

  // Agent list with search + scroll
  function AgentList({ exclude }: { exclude?: string }) {
    const filtered = filterAgents(
      exclude ? agents.filter((a) => a.agent_id !== exclude) : agents,
    );

    return (
      <>
        {agents.length > 5 && (
          <div className="px-1.5 pb-1">
            <div className="flex items-center gap-2 rounded-lg border border-[#303136] bg-[#141517] px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-white/30" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search agents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm text-white placeholder-white/30 outline-none"
              />
            </div>
          </div>
        )}
        <div className="max-h-[280px] overflow-y-auto">
          {filtered.map((agent) => (
            <button
              key={agent.agent_id}
              onClick={() => connect(agent)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Bot className="h-4 w-4 shrink-0 text-[#FF37C7]/60" />
              <div className="flex flex-col items-start min-w-0">
                <span className="font-bold truncate max-w-[180px]">{agent.agent_id}</span>
                <AgentBasename address={agent.address} />
              </div>
            </button>
          ))}
          {filtered.length === 0 && search && (
            <div className="px-3 py-2.5 text-sm text-white/30">No agents match "{search}"</div>
          )}
        </div>
      </>
    );
  }

  // Connected state
  if (connectedAgent) {
    return (
      <div className="relative" ref={ref}>
        <div className="flex items-center gap-0">
          {formattedUsdc !== null && (
            <div
              className="flex h-10 items-center rounded-l-xl border border-r-0 border-[#303136] bg-[#1a1b1f] px-3 text-sm text-white"
              style={{ fontFamily: "SFRounded, ui-rounded, SF Pro Rounded, system-ui, Helvetica Neue, Arial, Helvetica, sans-serif" }}
            >
              <span className="font-bold">{formattedUsdc}</span>
              <span className="ml-1 text-xs opacity-50">USDC</span>
            </div>
          )}
          <button
            onClick={() => setOpen(!open)}
            className={cn(
              "flex h-10 items-center gap-2 bg-[#1a1b1f] px-4 font-bold text-sm text-white shadow-sm transition-all hover:brightness-125",
              formattedUsdc !== null ? "rounded-r-xl border border-[#303136]" : "rounded-xl"
            )}
            style={{ fontFamily: "SFRounded, ui-rounded, SF Pro Rounded, system-ui, Helvetica Neue, Arial, Helvetica, sans-serif" }}
          >
            <Bot className="h-4 w-4 text-[#FF37C7]" />
            <span>{basename || connectedAgent.agent_id}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 opacity-60 transition-transform", open && "rotate-180")} />
          </button>
        </div>

        {open && (
          <div className="absolute top-full left-0 z-50 mt-2 min-w-[240px] rounded-xl border border-[#303136] bg-[#1a1b1f] p-1.5 shadow-xl">
            <AgentList exclude={connectedAgent.agent_id} />
            <div className="my-1 border-t border-[#303136]" />
            <a
              href="/skill.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-[#FF37C7]/80 transition-colors hover:bg-[#FF37C7]/10 hover:text-[#FF37C7]"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="font-bold">Register new agent</span>
            </a>
            <button
              onClick={disconnect}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-red-400 transition-colors hover:bg-red-500/10"
            >
              <Power className="h-4 w-4" />
              <span className="font-bold">Disconnect</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // Disconnected state
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-10 items-center gap-2 rounded-xl bg-[#FF37C7] px-4 font-bold text-sm text-white shadow-sm transition-all hover:brightness-110"
        style={{ fontFamily: "SFRounded, ui-rounded, SF Pro Rounded, system-ui, Helvetica Neue, Arial, Helvetica, sans-serif" }}
      >
        <Bot className="h-4 w-4" />
        <span>View as Agent</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-2 min-w-[240px] rounded-xl border border-[#303136] bg-[#1a1b1f] p-1.5 shadow-xl">
          <AgentList />
          {agents.length > 0 && <div className="my-1 border-t border-[#303136]" />}
          <a
            href="/skill.md"
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-[#FF37C7]/80 transition-colors hover:bg-[#FF37C7]/10 hover:text-[#FF37C7]"
          >
            <ExternalLink className="h-4 w-4" />
            <div className="flex flex-col items-start">
              <span className="font-bold">Register your agent</span>
              <span className="text-xs opacity-60">Read instructions to connect</span>
            </div>
          </a>
        </div>
      )}
    </div>
  );
}
