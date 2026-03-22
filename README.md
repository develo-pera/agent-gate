https://github.com/user-attachments/assets/9e41d010-e8bc-411c-aaec-3c7bd79b0ae8

# AgentGate

**Agent-to-agent DeFi infrastructure** — AI agents that earn yield, delegate scoped spending permissions, and trade autonomously on Base.

Built for [The Synthesis](https://synthesis.md/hack) hackathon.

**[Deployed URL](https://agent-gate-three.vercel.app/treasury)** | **[Moltbook Post](https://www.moltbook.com/post/8b995ab2-1f42-4999-b018-c9666361b68e)**

<p align="center">
  <img src="https://img.shields.io/badge/made%20during-Synthesis%20AI%20hackathon-00b73d" alt="TypeScript strict" />
  <img src="https://img.shields.io/badge/integrations-Lido%20%C2%B7%20Base%20%C2%B7%20MetaMask%20%C2%B7%20Uniswap%20%C2%B7%20ENS-ff007a" alt="integrations" />
  <img src="https://img.shields.io/badge/made%20for%20agents-Claude%20Code%20%C2%B7%20Codex%20%C2%B7%20Amp-blue" alt="supported agents" />
</p>


---

## What is AgentGate?

AgentGate is a full-stack system where AI agents manage on-chain treasuries, delegate yield-spending rights to each other, and execute autonomous trading strategies — all coordinated through a hosted MCP server.

Two agents (Hackaclaw and Merkle) each run Claude Code on separate machines, connect to a shared MCP server over HTTP, and operate against the same on-chain contracts. A real-time dashboard visualizes every vault, delegation, swap, and Aave lending action as it happens.

### Core Capabilities

- **Yield-only treasury** — any agent can deposit wstETH into an `AgentTreasury` contract to create a vault position. The principal is protected; only accrued yield (calculated via the Chainlink wstETH/stETH oracle) can be spent.
- **Scoped agent-to-agent delegation** — an agent with a vault position can authorize another agent as a yield spender with per-transaction and daily caps, without exposing the principal.
- **Autonomous trading recipes** — delegated agents can execute multi-step DeFi strategies: harvest yield, swap via Uniswap, lend on Aave V3, and return profits for compounding.
- **Aave V3 integration** — agents supply USDC to Aave V3 on Base to earn lending interest, check positions, and withdraw with accrued profit.
- **38 MCP tools across 8 domains** — identity/registration, Lido staking, treasury management, delegation, ENS/Basenames, Uniswap swaps, Aave V3 lending, and vault monitoring.
- **Hosted MCP server** — deployed on Vercel with HTTP transport and Bearer auth. First-party agents (server-side keys) and third-party agents (self-registered, unsigned tx pattern) supported.
- **Dynamic agent registration** — any agent can self-register via challenge-response (EIP-191 signature verification). Server never touches private keys. Auto-funded with 1 ETH on the fork.
- **Live dashboard** — Next.js app on Vercel with agent wallet connect, USDC balance display, Basename resolution, and real-time toast notifications for every on-chain action (treasury, swaps, Aave supply/withdraw).
- **Human wallet support** — connect via RainbowKit, claim test ETH from faucet, swap ETH → wstETH, deposit/withdraw from treasury. All writes via Anvil impersonation.
- **Dry-run simulation** — every tool supports a `dry_run` flag to simulate execution before committing transactions.

---

## Architecture

```
  First-Party Agents                    Third-Party Agents
  (Hackaclaw, Merkle)                   (self-registered)
        |                                   |
        | Bearer: agent_id                 | Bearer: api_key
        v                                   v
  +---------------------------------------------------+
  |         Hosted MCP Server (Vercel)                 |
  |         /api/mcp-agent                             |
  |                                                    |
  |  First-party: token -> env var key -> server signs |
  |  Third-party: token -> API key hash -> unsigned tx |
  |                                                    |
  |  38 tools:                                         |
  |  Identity/Reg (4) | Lido (7) | Treasury (10)       |
  |  Delegation (5) | ENS (2) | Uniswap (3)           |
  |  Trading/Aave (5) | Monitor (2)                    |
  +------------------------+---------------------------+
                           |
                           v
                  Anvil on Fly.io
                  (Base mainnet fork)
                           |
          +-------+--------+--------+--------+
          |       |        |        |        |
   AgentTreasury  Lido   Uniswap  Aave V3  Chainlink
    (custom)    wstETH    V3       Pool     Oracle
```

```
  +---------------------------------------------------+
  |         Dashboard (Vercel)                         |
  |         Next.js + wagmi + RainbowKit               |
  |                                                    |
  |  - View as Agent button (dynamic agent list)        |
  |  - USDC balance display (live polling)             |
  |  - Vault overview (principal / yield / total)      |
  |  - Delegation viewer (granted + received)          |
  |  - Basename resolution (hackaclaw.base.eth)        |
  |  - Autonomous trading recipes + open positions      |
  |  - Real-time toasts (filtered per agent)           |
  +---------------------------------------------------+
```

---

## MCP Tools (38)

### Identity & Registration (4)
| Tool | Description |
|------|-------------|
| `who_am_i` | Returns agent ID, wallet address, and access mode. Call first. |
| `register_challenge` | Step 1: get a challenge message to sign (proves address ownership) |
| `register_agent` | Step 2: submit signature to complete registration and receive API key |
| `submit_tx_hash` | Third-party agents: submit a signed tx hash for receipt verification |

### Lido (7)
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
| `treasury_deposit` | Deposit wstETH into the agent's vault |
| `treasury_status` | Vault principal, yield, and total balance |
| `treasury_authorize_spender` | Grant scoped spending rights (per-tx + daily caps) |
| `treasury_revoke_spender` | Remove a spender's access |
| `treasury_get_spender_config` | View a spender's caps and usage |
| `treasury_withdraw_yield` | Withdraw available yield (self) |
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

### Uniswap (3)
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

### Monitor (2)
| Tool | Description |
|------|-------------|
| `vault_health` | Combined health check across vault and oracle |
| `wallet_balance` | Check ETH and ERC-20 balances (USDC, wstETH, WETH, DAI, USDT, aUSDC) |

---

## Demo Flow (18 steps)

The full demo shows two AI agents collaborating on a yield-harvesting and lending strategy across treasury, Uniswap, and Aave V3 — with every action visible on the dashboard.

### Phase 1 — Identity
| Step | Agent | Tool | What Happens |
|------|-------|------|-------------|
| 1 | Both | `who_am_i` | Each agent discovers its address and ID from the MCP server |

### Phase 2 — Vault
| Step | Agent | Tool | What Happens |
|------|-------|------|-------------|
| 2 | Hackaclaw | `treasury_status` | Check vault state (principal + yield) |
| 3 | Hackaclaw | `treasury_deposit` | Deposit wstETH into vault |
| 4 | Hackaclaw | `treasury_status` | Verify principal increased |

### Phase 3 — Delegation
| Step | Agent | Tool | What Happens |
|------|-------|------|-------------|
| 5 | Hackaclaw | `treasury_authorize_spender` | Grant Merkle spending allowance on vault yield |
| 6 | Merkle | `treasury_get_spender_config` | Verify delegation received (caps, access level) |

### Phase 4 — Autonomous Trading (Merkle)
| Step | Agent | Tool | What Happens |
|------|-------|------|-------------|
| 7 | Merkle | `trading_list_recipes` | View "Yield Harvest & Lend" recipe |
| 8 | Merkle | `treasury_withdraw_yield_for` | Withdraw accrued yield from Hackaclaw's vault |
| 9 | Hackaclaw | `treasury_status` | Verify yield decreased after Merkle's withdrawal |
| 10 | Merkle | `uniswap_swap` | Swap wstETH to USDC |
| 11 | Merkle | `aave_supply` | Supply USDC to Aave V3 (earn lending interest) |
| 12 | Merkle | `aave_position` | Check Aave position (USDC + interest) |
| 13 | Merkle | `aave_withdraw` | Withdraw USDC + profit from Aave |
| 14 | Merkle | `transfer_token` | Send USDC profit back to Hackaclaw |

### Phase 5 — Compounding (Hackaclaw)
| Step | Agent | Tool | What Happens |
|------|-------|------|-------------|
| 15 | Hackaclaw | `uniswap_swap` | Swap USDC back to wstETH |
| 16 | Hackaclaw | `treasury_deposit` | Re-deposit into vault — principal grows (compounding) |
| 17 | Hackaclaw | `treasury_status` | Verify principal higher than before — compounding complete |

### Phase 6 — Monitoring
| Step | Agent | Tool | What Happens |
|------|-------|------|-------------|
| 18 | Either | `vault_health` | Full portfolio check |

**Dashboard during demo:** Every write action triggers a real-time toast notification filtered to the connected agent, showing basename, amount, and transaction hash.

---

## Why a Fork?

The AgentTreasury calculates yield based on the **Chainlink wstETH/stETH price feed** on Base:

```
yield = (currentRate - depositRate) * principal / currentRate
```

For yield to be non-zero, the oracle rate must increase between deposit time and withdrawal time. In production this happens naturally as Lido validators earn rewards.

The challenge: **Lido oracle reports are generated approximately once every 24 hours**. The Chainlink feed on Base updates accordingly. After consulting with the Lido team, we confirmed there is no way to accelerate this cadence on mainnet.

This creates a demo problem:
- **Base mainnet**: deposit and withdrawal in the same session always shows zero yield (rate hasn't changed)
- **Standard fork**: freezes all state at the fork block — the oracle rate never updates

**Solution**: A self-hosted **Anvil fork on Fly.io** (migrated from Tenderly Virtual TestNet which had a 20-block limit). We deploy a mock Chainlink oracle with a 5% higher rate using `anvil_setCode`, giving all vaults demonstrable yield. This provides real contract logic, real Uniswap liquidity, real Aave V3 lending pools, and demonstrable yield — all in a live, persistent environment that multiple agents can interact with simultaneously. Public RPC: `https://agentgate-anvil.fly.dev/`

---

## Dashboard Features

- **View as Agent** — RainbowKit-styled button that dynamically lists all registered agents (built-in + self-registered). Polls every 10s for new registrations. Click to connect, auto-reconnects via localStorage. Shows resolved basename after connection.
- **Human Wallet Support** — connect via RainbowKit. Faucet provides 1 test ETH (signature-protected, one-time claim). Swap ETH → wstETH card on treasury page. All writes executed via Anvil impersonation (no MetaMask RPC mismatch). ETH + wstETH balances displayed in header.
- **Vault Overview** — principal, total balance, and available yield with Chainlink exchange rate.
- **Delegation Viewer** — bidirectional view showing both granted (I authorized someone) and received (someone authorized me) delegations with direction badges. Filtered to only show delegations involving the connected agent.
- **Basename Resolution** — all addresses across the dashboard resolve to Base names (e.g., `hackaclaw.base.eth`). Vault overview, delegation cards/tables, address display tooltips, and toast notifications all show basenames.
- **Autonomous Trading** — available recipes with strategy descriptions. "Your Open Positions" section appears when an Aave V3 lending position is active.
- **Transaction Notifications** — real-time top-center toasts filtered per connected agent. Shows only events involving your address: deposits, yield withdrawals, spender authorization/revocation, Uniswap swaps, Aave supply/withdraw.
- **MCP Playground** — interactive tool caller with all 38 tools, parameter forms, and JSON request/response viewer.
- **Agent Registration** — "AI Agent? Register to access DeFi tools" CTA banner. "Register your agent" link in View as Agent dropdown.

---

## Bounty Targets

### Lido — MCP Server
Full MCP server with 7 Lido tools (stake, wrap, APR, balances, rewards, governance, voting), dry-run simulation, and an agent skill file (`lido.skill.md`) that teaches agents the stETH/wstETH mental model.

### Lido — stETH Agent Treasury
`AgentTreasury.sol` — a wstETH vault where any AI agent can deposit to create a vault position and only spend accrued yield. Uses the Chainlink wstETH/stETH oracle for yield calculation. Includes scoped spender authorization with per-transaction and daily caps.

### MetaMask — Best Use of Delegations
5 delegation MCP tools built on MetaMask Smart Accounts Kit (ERC-7710/ERC-4337). Agents deploy smart accounts, create scoped delegations with caveat enforcers (ERC-20 transfer caps, native token limits), redeem delegations on-chain via the DelegationManager, and revoke permissions irreversibly. Complements the treasury's built-in spender authorization with a general-purpose delegation framework.

### Uniswap — Agentic Finance
3 Uniswap MCP tools (quote, swap, tokens) enabling agents to autonomously trade on Uniswap V3. Agents convert yield to stablecoins, rebalance positions, and swap profits back for compounding — all through natural language commands.

### Base — Autonomous Trading Agent
5 trading/Aave MCP tools enabling a delegated agent to execute the "Yield Harvest & Lend" recipe autonomously: withdraw yield → swap to USDC → supply to Aave V3 → earn lending interest → withdraw profit → transfer back to the depositor → re-deposit for compounding. No human intervention after initial delegation.

### Synthesis — Open Track
End-to-end agent-to-agent DeFi infrastructure: hosted MCP server, treasury contracts, delegation framework, Aave V3 lending integration, real-time dashboard, and a complete 18-step demo flow showing two AI agents collaborating on yield management and autonomous trading.

---

## Quick Start

### 1. Deploy the Treasury (Anvil Fork)

```bash
cd packages/treasury-contract
./anvil-demo-setup.sh <ANVIL_RPC> <HACKACLAW_KEY> <MERKLE_KEY>
```

This deploys `AgentTreasury`, deposits wstETH for Hackaclaw, simulates ~5% yield, and registers basenames.

### 2. Deploy to Vercel

Set the following environment variables on your Vercel project:

```
RPC_URL=<anvil RPC>
L1_RPC_URL=<ethereum mainnet RPC>
NEXT_PUBLIC_RPC_URL=<anvil RPC>
NEXT_PUBLIC_CHAIN_ID=8453
TREASURY_ADDRESS=<deployed treasury address>
NEXT_PUBLIC_TREASURY_ADDRESS=<deployed treasury address>
NEXT_PUBLIC_DEMO_TREASURY_ADDRESS=<hackaclaw address>
PRIVATE_KEY=<hackaclaw private key>
MERKLE_KEY=<merkle private key>
UNISWAP_API_KEY=<uniswap API key>
```

### 3. Connect Agents

Each agent runs one command on their own machine:

```bash
npx @anthropic-ai/claude-code mcp add agentgate -- npx mcp-remote \
  https://<your-vercel-app>.vercel.app/api/mcp-agent \
  --header "Authorization: Bearer <your-agent-id>"
```

---

## Project Structure

```
packages/
  mcp-server/              MCP server (TypeScript)
    src/
      tools/               Tool implementations by domain
        lido.ts            Lido staking (7 tools)
        treasury.ts        Vault management (10 tools)
        delegation.ts      ERC-7710 delegations (5 tools)
        ens.ts             Base name resolution (2 tools)
        uniswap.ts         Uniswap V3 swaps — fork-aware (3 tools)
        trading.ts         Aave V3 lending + recipes (5 tools)
        monitor.ts         Vault health + wallet balance (2 tools)
      hosted.ts            HTTP transport, dual-mode auth, registration tools
      registry.ts          AgentRegistry, challenge-response, API key management
      execute-or-prepare.ts  Dual-mode write (sign or return unsigned tx)
      bridge.ts            Dashboard HTTP bridge (read + impersonated writes)
    lido.skill.md          Agent mental model for stETH/wstETH
    agentgate.skill.md     Full agent onboarding documentation
  treasury-contract/       AgentTreasury (Solidity, Foundry)
    contracts/
    test/
    anvil-demo-setup.sh
  app/                     Dashboard (Next.js, wagmi, RainbowKit)
    src/
      components/          UI components + agent connect + tx notifications
      lib/
        hooks/             On-chain data hooks + Basename resolution
        agent-store.ts     Upstash Redis agent store
      providers/           App context + wallet config
      app/api/
        mcp-agent/         MCP HTTP endpoint (Bearer auth routing)
        agents/            Agent list + registration endpoints
        faucet/            Signature-protected test ETH faucet
        swap/              ETH → wstETH swap for human wallets
    public/skill.md        Agent onboarding docs (public)
scripts/
  register-agent.sh        Shell script for operator agent setup
```

---

## License

MIT
