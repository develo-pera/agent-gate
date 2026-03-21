# AGENTS.md — AgentGate

## System Overview

AgentGate is agent-to-agent DeFi infrastructure on Base. AI agents deposit wstETH into a yield-protected treasury, delegate scoped spending rights to each other, and execute autonomous trading strategies — all coordinated through a hosted MCP server with 33 tools.

## Agent Architecture

```
  Agent (Claude Code)
        |
        | Bearer: <agent_id>
        v
  Hosted MCP Server (Vercel, /api/mcp-agent)
        |
        | Bearer token -> agent ID -> server-side private key
        v
  Anvil Fork of Base Mainnet (Fly.io)
        |
  AgentTreasury | Lido wstETH | Uniswap V3 | Aave V3 | Chainlink Oracle
```

Each agent authenticates with a Bearer token. The MCP server resolves the token to an agent ID and a server-side private key — agents never hold their own keys. All on-chain actions are executed server-side.

## Registered Agents

| Agent ID | Basename | Role |
|----------|----------|------|
| `hackaclaw` | hackaclaw.base.eth | Vault depositor — deposits wstETH, delegates yield spending, compounds profits |
| `merkle` | merkle.base.eth | Delegated spender — harvests yield, swaps, lends on Aave, returns profit |

## Connecting to the MCP Server

```bash
npx @anthropic-ai/claude-code mcp add agentgate -- npx mcp-remote \
  https://<vercel-app>.vercel.app/api/mcp-agent \
  --header "Authorization: Bearer <agent_id>"
```

## First Tool Call

Every agent session **must** begin with `who_am_i`. This returns your agent ID and wallet address. Your wallet is server-side — you cannot discover it locally. Use the returned address for all subsequent tool calls that require an address.

## MCP Tools (33)

### Identity (1)
| Tool | Description |
|------|-------------|
| `who_am_i` | Returns agent ID and wallet address. Call first. |

### Lido Staking (7)
| Tool | Description |
|------|-------------|
| `lido_stake` | Stake ETH to receive stETH |
| `lido_wrap` | Wrap stETH to wstETH (or unwrap) |
| `lido_get_apr` | Current Lido staking APR |
| `lido_balance` | wstETH/stETH balances for an address |
| `lido_rewards` | Historical reward data |
| `lido_governance` | Lido DAO governance proposals |
| `lido_governance_vote` | Vote on Lido governance proposals |

### Treasury (10)
| Tool | Description |
|------|-------------|
| `treasury_deposit` | Deposit wstETH into the agent's vault position |
| `treasury_status` | Vault principal, yield, and total balance |
| `treasury_authorize_spender` | Grant scoped spending rights (per-tx + daily caps) |
| `treasury_revoke_spender` | Remove a spender's access |
| `treasury_get_spender_config` | View a spender's caps and usage |
| `treasury_withdraw_yield` | Withdraw available yield (depositor) |
| `treasury_withdraw_yield_for` | Withdraw yield as an authorized spender |
| `treasury_set_recipient_whitelist` | Toggle recipient whitelist enforcement |
| `treasury_set_allowed_recipient` | Add/remove addresses from the whitelist |
| `treasury_get_rate` | Current Chainlink wstETH/stETH exchange rate |

### Delegation (5)
| Tool | Description |
|------|-------------|
| `delegate_create_account` | Deploy a delegation-aware smart account |
| `delegate_create` | Create an ERC-7710 delegation with caveats |
| `delegate_redeem` | Execute an action using a delegated permission |
| `delegate_list` | List active delegations for an address |
| `delegate_revoke` | Revoke a specific delegation |

### ENS / Basenames (2)
| Tool | Description |
|------|-------------|
| `ens_resolve` | Resolve a Base name to an address |
| `ens_reverse` | Reverse-resolve an address to a Base name |

### Uniswap V3 (3)
| Tool | Description |
|------|-------------|
| `uniswap_quote` | Get a swap quote (price + route) |
| `uniswap_swap` | Execute a token swap via Uniswap V3 |
| `uniswap_tokens` | List available tokens and balances |

### Trading / Aave V3 (5)
| Tool | Description |
|------|-------------|
| `trading_list_recipes` | List available autonomous trading strategies |
| `aave_supply` | Supply USDC to Aave V3 on Base (approve + deposit) |
| `aave_withdraw` | Withdraw USDC + accrued interest from Aave V3 |
| `aave_position` | Check Aave V3 lending position (balance, collateral, health factor) |
| `transfer_token` | Transfer ERC-20 tokens (USDC, wstETH, or any address) |

### Monitor (1)
| Tool | Description |
|------|-------------|
| `vault_health` | Combined health check across vault and oracle |

## Key Concepts

### Vault Positions (not ownership)
Any agent can `deposit()` wstETH to create a vault position. There is no single vault owner — the contract maps `address => Vault`. Each depositor's principal is protected; only accrued yield can be spent. Yield is calculated on-chain using the Chainlink wstETH/stETH exchange rate oracle.

### Scoped Delegation
A depositor can authorize another agent as a yield spender with:
- **Per-transaction cap** — max wstETH per withdrawal
- **Daily window allowance** — max wstETH per time window
- **Yield-only restriction** — spender can never touch principal

### Autonomous Trading Recipe: Yield Harvest & Lend
The primary multi-step strategy a delegated agent can execute:
1. `treasury_withdraw_yield_for` — withdraw yield from depositor's vault
2. `uniswap_swap` — swap wstETH to USDC
3. `aave_supply` — deposit USDC into Aave V3 (earn lending interest)
4. `aave_withdraw` — withdraw USDC + profit
5. `transfer_token` — send profit back to depositor
6. Depositor calls `treasury_deposit` — compound profit into principal

### Dry Run
Every write tool supports a `dry_run: true` flag that simulates the action and returns expected outcomes without executing any transactions.

## Demo Flow (18 steps)

| Phase | Steps | What Happens |
|-------|-------|-------------|
| 1. Identity | 1 | Both agents call `who_am_i` |
| 2. Vault | 2-4 | Hackaclaw checks vault, deposits wstETH, verifies principal |
| 3. Delegation | 5-6 | Hackaclaw authorizes Merkle as yield spender, Merkle verifies |
| 4. Trading | 7-14 | Merkle harvests yield, swaps to USDC, lends on Aave, withdraws profit, transfers back |
| 5. Compounding | 15-17 | Hackaclaw swaps USDC to wstETH, re-deposits, verifies principal grew |
| 6. Monitoring | 18 | Either agent runs `vault_health` |

## On-Chain Contracts

| Contract | Address | Network |
|----------|---------|---------|
| AgentTreasury | Deployed per environment | Base (Anvil fork) |
| wstETH | `0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452` | Base |
| Chainlink wstETH/stETH | `0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061` | Base |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Base |
| Aave V3 Pool | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` | Base |
| aUSDC (Aave receipt) | `0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB` | Base |
| Uniswap Universal Router | `0x6fF5693b99212Da76ad316178A184AB56D299b43` | Base |

## Project Structure

```
packages/
  mcp-server/           MCP server (TypeScript, 33 tools)
    src/
      tools/            Tool implementations by domain
        lido.ts         Lido staking (7 tools)
        treasury.ts     Vault management (10 tools)
        delegation.ts   ERC-7710 delegations (5 tools)
        ens.ts          Base name resolution (2 tools)
        uniswap.ts      Uniswap V3 swaps (3 tools)
        trading.ts      Aave V3 lending + recipes (5 tools)
        monitor.ts      Vault health (1 tool)
      hosted.ts         HTTP transport + agent key mapping
      context.ts        Shared context (viem clients, wallet)
    lido.skill.md       Agent mental model for stETH/wstETH
  treasury-contract/    AgentTreasury (Solidity, Foundry)
    contracts/
    test/
    anvil-demo-setup.sh
  app/                  Dashboard (Next.js, wagmi, RainbowKit)
    src/
      components/       UI components + agent connect + tx notifications
      lib/hooks/        On-chain data hooks + Basename resolution
      providers/        App context + wallet config
      app/api/
        mcp-agent/      MCP HTTP endpoint (Bearer auth routing)
        agents/         Dynamic agent list endpoint
```

## Dashboard

The Next.js dashboard at the project root visualizes all agent activity in real time:

- **View as Agent** — connect as any registered agent to see their perspective
- **Treasury** — vault principal, total balance, APY, and available yield (yield visible only to the depositor)
- **Staking** — Lido staking positions and wstETH balances
- **Delegations** — bidirectional view of granted and received spending authorizations
- **Autonomous Trading** — recipe descriptions and live Aave V3 position data when active
- **MCP Playground** — interactive tool caller with all 33 tools
- **Toast Notifications** — real-time, filtered per connected agent (deposits, swaps, delegations, Aave actions)
