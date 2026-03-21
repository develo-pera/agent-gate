/**
 * Static tool schema registry for all 25 visible MCP tools.
 *
 * Used by the playground UI for dynamic form generation, domain grouping,
 * and human-friendly display. Tool names must match bridge toolRegistry keys.
 */

// ── Types ──────────────────────────────────────────────────────────────

export type ParamType = "string" | "number" | "boolean" | "enum";
export type Domain = "Lido" | "Treasury" | "Delegation" | "ENS" | "Monitor";

export interface ToolParam {
  name: string;
  type: ParamType;
  description: string;
  required: boolean;
  default?: string | number | boolean;
  enumValues?: string[];
  isAddress?: boolean;
  isAmount?: boolean;
}

export interface ToolSchema {
  name: string;
  humanName: string;
  domain: Domain;
  description: string;
  params: ToolParam[];
  hasWriteEffect: boolean;
}

// ── Domain Ordering ────────────────────────────────────────────────────

export const DOMAIN_ORDER: Domain[] = [
  "Lido",
  "Treasury",
  "Delegation",
  "ENS",
  "Monitor",
];

// ── Tool Schemas ───────────────────────────────────────────────────────

export const TOOL_SCHEMAS: ToolSchema[] = [
  // ── Lido (7 tools) ─────────────────────────────────────────────────

  {
    name: "lido_stake",
    humanName: "Stake ETH (Lido)",
    domain: "Lido",
    description:
      "Simulate staking ETH with Lido. Reads L1 Ethereum state to estimate stETH received.",
    params: [
      {
        name: "amount_eth",
        type: "string",
        description: "Amount of ETH to stake (e.g. '1.5')",
        required: true,
        isAmount: true,
      },
      {
        name: "referral",
        type: "string",
        description: "Referral address (optional, defaults to zero address)",
        required: false,
        isAddress: true,
      },
    ],
    hasWriteEffect: true,
  },
  {
    name: "lido_wrap",
    humanName: "Wrap/Unwrap stETH",
    domain: "Lido",
    description:
      "Preview stETH to wstETH conversion using L1 exchange rate.",
    params: [
      {
        name: "direction",
        type: "enum",
        description: "'wrap' = stETH to wstETH, 'unwrap' = wstETH to stETH",
        required: true,
        enumValues: ["wrap", "unwrap"],
      },
      {
        name: "amount",
        type: "string",
        description:
          "Amount to convert (in stETH for wrap, wstETH for unwrap)",
        required: true,
        isAmount: true,
      },
    ],
    hasWriteEffect: true,
  },
  {
    name: "lido_get_apr",
    humanName: "Get Staking APR",
    domain: "Lido",
    description:
      "Get the current Lido stETH staking APR and protocol stats.",
    params: [],
    hasWriteEffect: false,
  },
  {
    name: "lido_balance",
    humanName: "Check Lido Balances",
    domain: "Lido",
    description:
      "Check stETH and wstETH balances across L1 Ethereum and Base for an address.",
    params: [
      {
        name: "address",
        type: "string",
        description: "Ethereum address to check",
        required: true,
        isAddress: true,
      },
    ],
    hasWriteEffect: false,
  },
  {
    name: "lido_rewards",
    humanName: "Reward History",
    domain: "Lido",
    description:
      "Fetch stETH reward history for an address using Lido's Reward History API.",
    params: [
      {
        name: "address",
        type: "string",
        description: "Ethereum address",
        required: true,
        isAddress: true,
      },
      {
        name: "limit",
        type: "number",
        description: "Number of entries (default 10)",
        required: false,
        default: 10,
      },
    ],
    hasWriteEffect: false,
  },
  {
    name: "lido_governance",
    humanName: "Governance Proposals",
    domain: "Lido",
    description:
      "Fetch active and recent Lido DAO governance proposals from Snapshot.",
    params: [
      {
        name: "state",
        type: "enum",
        description: "Filter by proposal state (default: active)",
        required: false,
        default: "active",
        enumValues: ["active", "closed", "all"],
      },
      {
        name: "limit",
        type: "number",
        description: "Number of proposals to return (default: 5)",
        required: false,
        default: 5,
      },
    ],
    hasWriteEffect: false,
  },
  {
    name: "lido_governance_vote",
    humanName: "Vote on Proposal",
    domain: "Lido",
    description:
      "Cast a vote on an active Lido DAO Snapshot proposal. Requires LDO tokens on L1.",
    params: [
      {
        name: "proposal_id",
        type: "string",
        description: "Snapshot proposal ID (from lido_governance results)",
        required: true,
      },
      {
        name: "choice",
        type: "number",
        description:
          "Choice index (1-based, matching the choices array from the proposal)",
        required: true,
      },
      {
        name: "reason",
        type: "string",
        description: "Optional reason for your vote",
        required: false,
      },
    ],
    hasWriteEffect: true,
  },

  // ── Treasury (10 tools) ────────────────────────────────────────────

  {
    name: "treasury_deposit",
    humanName: "Deposit to Treasury",
    domain: "Treasury",
    description:
      "Deposit wstETH into the AgentTreasury. Principal is locked; only yield can be spent.",
    params: [
      {
        name: "amount_wsteth",
        type: "string",
        description: "Amount of wstETH to deposit (e.g. '0.01')",
        required: true,
        isAmount: true,
      },
    ],
    hasWriteEffect: true,
  },
  {
    name: "treasury_status",
    humanName: "Vault Status",
    domain: "Treasury",
    description:
      "Check an agent's vault: deposited principal, available yield, total balance, and exchange rate.",
    params: [
      {
        name: "agent_address",
        type: "string",
        description: "Agent address to check vault status for",
        required: true,
        isAddress: true,
      },
    ],
    hasWriteEffect: false,
  },
  {
    name: "treasury_get_rate",
    humanName: "Exchange Rate",
    domain: "Treasury",
    description:
      "Get the current wstETH/stETH exchange rate from the Chainlink oracle on Base.",
    params: [],
    hasWriteEffect: false,
  },
  {
    name: "treasury_get_spender_config",
    humanName: "Spender Config",
    domain: "Treasury",
    description:
      "Check a spender's authorization config for a vault: per-tx cap, window budget, spending history.",
    params: [
      {
        name: "agent_address",
        type: "string",
        description: "Vault depositor's address",
        required: true,
        isAddress: true,
      },
      {
        name: "spender_address",
        type: "string",
        description: "Spender address to check",
        required: true,
        isAddress: true,
      },
    ],
    hasWriteEffect: false,
  },
  {
    name: "treasury_authorize_spender",
    humanName: "Authorize Spender",
    domain: "Treasury",
    description:
      "Authorize another agent to spend yield from your vault with configurable limits.",
    params: [
      {
        name: "spender",
        type: "string",
        description: "Address to authorize as yield spender",
        required: true,
        isAddress: true,
      },
      {
        name: "yield_only",
        type: "boolean",
        description:
          "If true (default), spender can only access yield, never principal",
        required: false,
        default: true,
      },
      {
        name: "max_per_tx",
        type: "string",
        description:
          "Max wstETH per transaction (e.g. '0.001'). 0 or omit = unlimited",
        required: false,
        isAmount: true,
      },
      {
        name: "window_duration",
        type: "number",
        description:
          "Time window in seconds for spending limit (e.g. 3600 = 1 hour)",
        required: false,
      },
      {
        name: "window_allowance",
        type: "string",
        description:
          "Max wstETH spendable per window (e.g. '0.005'). 0 or omit = unlimited",
        required: false,
        isAmount: true,
      },
    ],
    hasWriteEffect: true,
  },
  {
    name: "treasury_revoke_spender",
    humanName: "Revoke Spender",
    domain: "Treasury",
    description:
      "Revoke a spender's authorization to withdraw yield from your vault.",
    params: [
      {
        name: "spender",
        type: "string",
        description: "Address of the spender to revoke",
        required: true,
        isAddress: true,
      },
    ],
    hasWriteEffect: true,
  },
  {
    name: "treasury_withdraw_yield",
    humanName: "Withdraw Yield",
    domain: "Treasury",
    description:
      "Withdraw accrued yield from your own vault. Cannot exceed available yield.",
    params: [
      {
        name: "recipient",
        type: "string",
        description: "Address to receive the yield",
        required: true,
        isAddress: true,
      },
      {
        name: "amount_wsteth",
        type: "string",
        description: "Amount of wstETH yield to withdraw",
        required: true,
        isAmount: true,
      },
    ],
    hasWriteEffect: true,
  },
  {
    name: "treasury_withdraw_yield_for",
    humanName: "Withdraw Yield (Spender)",
    domain: "Treasury",
    description:
      "Withdraw yield from another agent's vault as an authorized spender.",
    params: [
      {
        name: "agent_address",
        type: "string",
        description: "Vault depositor's address",
        required: true,
        isAddress: true,
      },
      {
        name: "recipient",
        type: "string",
        description: "Address to receive the yield",
        required: true,
        isAddress: true,
      },
      {
        name: "amount_wsteth",
        type: "string",
        description: "Amount of wstETH yield to withdraw",
        required: true,
        isAmount: true,
      },
    ],
    hasWriteEffect: true,
  },
  {
    name: "treasury_set_recipient_whitelist",
    humanName: "Toggle Recipient Whitelist",
    domain: "Treasury",
    description:
      "Toggle recipient whitelist for your vault. When enabled, spenders can only send yield to pre-approved addresses.",
    params: [
      {
        name: "enabled",
        type: "boolean",
        description:
          "true = only whitelisted recipients allowed, false = any recipient ok",
        required: true,
      },
    ],
    hasWriteEffect: true,
  },
  {
    name: "treasury_set_allowed_recipient",
    humanName: "Manage Allowed Recipient",
    domain: "Treasury",
    description:
      "Add or remove an address from your vault's recipient whitelist.",
    params: [
      {
        name: "recipient",
        type: "string",
        description: "Address to whitelist or remove",
        required: true,
        isAddress: true,
      },
      {
        name: "allowed",
        type: "boolean",
        description: "true = allow, false = remove from whitelist",
        required: true,
      },
    ],
    hasWriteEffect: true,
  },

  // ── Delegation (5 tools) ───────────────────────────────────────────

  {
    name: "delegate_create_account",
    humanName: "Create Smart Account",
    domain: "Delegation",
    description:
      "Create a MetaMask Smart Account (ERC-4337) for an agent. Required before creating or redeeming delegations.",
    params: [
      {
        name: "private_key",
        type: "string",
        description:
          "Private key for the account signer (uses server wallet if omitted)",
        required: false,
      },
    ],
    hasWriteEffect: true,
  },
  {
    name: "delegate_create",
    humanName: "Create Delegation",
    domain: "Delegation",
    description:
      "Create an ERC-7710 delegation granting another agent scoped permission to act on your behalf.",
    params: [
      {
        name: "delegate_address",
        type: "string",
        description:
          "Address of the agent/account receiving the delegation",
        required: true,
        isAddress: true,
      },
      {
        name: "scope_type",
        type: "enum",
        description: "Type of permission scope",
        required: true,
        enumValues: ["erc20TransferAmount", "nativeTokenTransferAmount"],
      },
      {
        name: "token_address",
        type: "string",
        description:
          "ERC-20 token address (required for erc20TransferAmount)",
        required: false,
        isAddress: true,
      },
      {
        name: "max_amount",
        type: "string",
        description:
          "Maximum amount the delegate can spend (human-readable, e.g. '0.5')",
        required: true,
        isAmount: true,
      },
      {
        name: "token_decimals",
        type: "number",
        description: "Token decimals (default: 18)",
        required: false,
        default: 18,
      },
    ],
    hasWriteEffect: true,
  },
  {
    name: "delegate_redeem",
    humanName: "Redeem Delegation",
    domain: "Delegation",
    description:
      "Redeem a delegation to execute an action on behalf of the delegator.",
    params: [
      {
        name: "delegation_id",
        type: "string",
        description: "Delegation ID returned by delegate_create",
        required: true,
      },
      {
        name: "target_contract",
        type: "string",
        description:
          "Contract to call (e.g. treasury address, token address)",
        required: true,
        isAddress: true,
      },
      {
        name: "call_data",
        type: "string",
        description: "Hex-encoded calldata for the target function",
        required: true,
      },
    ],
    hasWriteEffect: true,
  },
  {
    name: "delegate_list",
    humanName: "List Delegations",
    domain: "Delegation",
    description:
      "List all delegations stored in this session -- both granted and received.",
    params: [],
    hasWriteEffect: false,
  },
  {
    name: "delegate_revoke",
    humanName: "Revoke Delegation",
    domain: "Delegation",
    description:
      "Disable a delegation on-chain via DelegationManager. Irreversible.",
    params: [
      {
        name: "delegation_id",
        type: "string",
        description: "Delegation ID to revoke",
        required: true,
      },
    ],
    hasWriteEffect: true,
  },

  // ── ENS (2 tools) ─────────────────────────────────────────────────

  {
    name: "ens_resolve",
    humanName: "Resolve ENS Name",
    domain: "ENS",
    description:
      "Resolve an ENS name to its Ethereum address.",
    params: [
      {
        name: "name",
        type: "string",
        description: "ENS name to resolve (e.g., 'vitalik.eth')",
        required: true,
        default: "vitalik.eth",
      },
    ],
    hasWriteEffect: false,
  },
  {
    name: "ens_reverse",
    humanName: "Reverse Lookup",
    domain: "ENS",
    description:
      "Reverse-resolve an Ethereum address to its primary ENS name.",
    params: [
      {
        name: "address",
        type: "string",
        description: "Ethereum address to reverse-resolve",
        required: true,
        isAddress: true,
      },
    ],
    hasWriteEffect: false,
  },

  // ── Monitor (1 tool) ──────────────────────────────────────────────

  {
    name: "vault_health",
    humanName: "Vault Health Report",
    domain: "Monitor",
    description:
      "Generate a plain-language health report for an agent's stETH/wstETH position.",
    params: [
      {
        name: "address",
        type: "string",
        description: "Agent/wallet address to analyze",
        required: true,
        isAddress: true,
      },
    ],
    hasWriteEffect: false,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────

export function getToolsByDomain(): Record<Domain, ToolSchema[]> {
  const grouped: Record<Domain, ToolSchema[]> = {
    Lido: [],
    Treasury: [],
    Delegation: [],
    ENS: [],
    Monitor: [],
  };
  for (const tool of TOOL_SCHEMAS) {
    grouped[tool.domain].push(tool);
  }
  return grouped;
}
