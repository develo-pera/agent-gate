import type { Chain } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";

export interface AgentGateContext {
  publicClient: any;
  l1PublicClient: any;
  walletClient?: any;
  walletAccount?: PrivateKeyAccount;
  dryRun: boolean;
  chain: Chain;
  allAddresses?: `0x${string}`[];
}
