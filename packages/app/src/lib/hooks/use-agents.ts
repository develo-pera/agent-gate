import { useQuery } from "@tanstack/react-query";

export interface AgentInfo {
  agent_id: string;
  name: string;
  address: string;
  type: string;
  createdAt: string;
  status: "active" | "idle" | "registered";
  lastActivityAt: number | null;
}

interface AgentsResponse {
  agents: AgentInfo[];
}

export function useAgents() {
  const { data, isLoading, error } = useQuery<AgentsResponse>({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error("Failed to fetch agents");
      return res.json();
    },
    refetchInterval: 10000,
  });

  return {
    agents: data?.agents ?? [],
    isLoading,
    error,
  };
}
