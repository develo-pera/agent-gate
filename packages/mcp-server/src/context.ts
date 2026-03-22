import type { Chain } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";

export interface AgentGateContext {
  publicClient: any;
  l1PublicClient: any;
  walletClient?: any;
  walletAccount?: PrivateKeyAccount;
  agentAddress: `0x${string}`;
  agentType: "first-party" | "third-party";
  dryRun: boolean;
  chain: Chain;
  allAddresses?: `0x${string}`[];
  activeEventId?: number;  // Set by activity logging wrapper during tool execution
}
