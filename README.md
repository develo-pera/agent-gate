# AgentGate

**Agent-to-agent DeFi infrastructure** — AI agents that earn yield, delegate scoped spending permissions, and trade autonomously on Base.

Built for [The Synthesis](https://synthesis.md/hack) hackathon.

---

## What is AgentGate?

AgentGate is a full-stack system where AI agents manage on-chain treasuries, delegate yield-spending rights to each other, and execute DeFi operations — all coordinated through a hosted MCP server.

Two agents (Hackaclaw and Merkle) each run Claude Code on separate machines, connect to a shared MCP server over HTTP, and operate against the same on-chain contracts. A real-time dashboard visualizes every vault, delegation, and transaction as it happens.

### Core Capabilities

- **Yield-only treasury** — agents deposit wstETH into an `AgentTreasury` contract. The principal is locked; only accrued yield (calculated via the Chainlink wstETH/stETH oracle) can be spent.
- **Scoped agent-to-agent delegation** — one agent authorizes another as a yield spender with per-transaction and daily caps, without exposing the principal.
- **28 MCP tools across 6 domains** — Lido staking, treasury management, delegation, ENS/Basenames, Uniswap swaps, and vault monitoring.
- **Hosted MCP server** — deployed on Vercel with HTTP transport and Bearer auth. Agents connect with one command; private keys never leave the server.
- **Live dashboard** — Next.js app on Vercel showing vault balances, delegation status, Basename resolution, and real-time toast notifications for every on-chain action.
- **Dry-run simulation** — every tool supports a `dry_run` flag to simulate execution before committing transactions.

---

## Architecture

```
  Hackaclaw (Claude Code)             Merkle (Claude Code)
        |                                   |
        | Bearer: hackaclaw                 | Bearer: merkle
        v                                   v
  +---------------------------------------------------+
  |         Hosted MCP Server (Vercel)                 |
  |         /api/mcp-agent                             |
  |                                                    |
  |  Bearer token -> agent ID -> private key (env var) |
  |                                                    |
  |  28 tools:                                         |
  |  Lido (7) | Treasury (10) | Delegation (5)         |
  |  ENS (2)  | Uniswap (3)  | Monitor (1)            |
  +------------------------+---------------------------+
                           |
                           v
               Tenderly Virtual TestNet
                  (Base mainnet fork)
                           |
          +----------------+----------------+
          |                |                |
   AgentTreasury     Lido wstETH      Uniswap V3
    (custom)          (bridged)        (forked)
          |
          v
    Chainlink wstETH/stETH
       Oracle Feed

  +---------------------------------------------------+
  |         Dashboard (Vercel)                         |
  |         Next.js + wagmi + RainbowKit               |
  |                                                    |
  |  - Vault overview (principal / yield / total)      |
  |  - Spender configuration panel                     |
  |  - Basename resolution (hackaclaw.base.eth)        |
  |  - Real-time tx toast notifications                |
  |  - Human wallet connection (Base mainnet)          |
  +---------------------------------------------------+
```

---

## MCP Tools (28)

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
| `ens_resolve` | Resolve a name to an address |
| `ens_reverse` | Reverse-resolve an address to a name |

### Uniswap (3)
| Tool | Description |
|------|-------------|
| `uniswap_quote` | Get a swap quote (price + route) |
| `uniswap_swap` | Execute a token swap via Uniswap V3 |
| `uniswap_tokens` | List available tokens and balances |

### Monitor (1)
| Tool | Description |
|------|-------------|
| `vault_health` | Combined health check across vault and oracle |

---

## Why a Tenderly Fork?

The AgentTreasury calculates yield based on the **Chainlink wstETH/stETH price feed** on Base:

```
yield = (currentRate - depositRate) * principal / currentRate
```

For yield to be non-zero, the oracle rate must increase between deposit time and withdrawal time. In production this happens naturally as Lido validators earn rewards.

The challenge: **Lido oracle reports are generated approximately once every 24 hours**. The Chainlink feed on Base updates accordingly. After consulting with the Lido team, we confirmed there is no way to accelerate this cadence on mainnet.

This creates a demo problem:
- **Base mainnet**: deposit and withdrawal in the same session always shows zero yield (rate hasn't changed)
- **Anvil fork**: freezes all state at the fork block — the oracle rate never updates, so yield is always zero regardless of which block you fork from

**Solution**: A [Tenderly Virtual TestNet](https://tenderly.co/virtual-testnets) (Base mainnet fork) allows us to use `tenderly_setStorageAt` to simulate yield by adjusting the stored `principalStETHValue` after deposit. This gives us real contract logic, real Uniswap liquidity, and demonstrable yield — all in a live, persistent environment that multiple agents can interact with simultaneously.

---

## Quick Start

### 1. Deploy the Treasury (Tenderly Fork)

```bash
cd packages/treasury-contract
./tenderly-demo-setup.sh <TENDERLY_ADMIN_RPC> <HACKACLAW_KEY> <MERKLE_KEY>
```

This deploys `AgentTreasury`, deposits wstETH for Hackaclaw, and simulates ~5% yield.

### 2. Deploy to Vercel

Set the following environment variables on your Vercel project:

```
RPC_URL=<tenderly admin RPC>
NEXT_PUBLIC_RPC_URL=<tenderly public RPC>
NEXT_PUBLIC_CHAIN_ID=<tenderly chain ID>
TREASURY_ADDRESS=<deployed treasury address>
NEXT_PUBLIC_TREASURY_ADDRESS=<deployed treasury address>
NEXT_PUBLIC_DEMO_TREASURY_ADDRESS=<hackaclaw address>
PRIVATE_KEY=<hackaclaw private key>
MERKLE_KEY=<merkle private key>
UNISWAP_API_KEY=<uniswap API key>
```

### 3. Connect Agents

Each agent runs one command on their own machine:

**Hackaclaw:**
```bash
claude mcp add --transport http agentgate \
  https://<your-vercel-app>.vercel.app/api/mcp-agent \
  --header "Authorization: Bearer hackaclaw"
```

**Merkle:**
```bash
claude mcp add --transport http agentgate \
  https://<your-vercel-app>.vercel.app/api/mcp-agent \
  --header "Authorization: Bearer merkle"
```

### 4. Run the Demo

| Step | Agent | Action | Dashboard Effect |
|------|-------|--------|-----------------|
| 1 | Hackaclaw | "check my treasury vault" | Vault shows principal + yield |
| 2 | Hackaclaw | "what's the current Lido APR?" | APR displayed |
| 3 | Hackaclaw | "authorize Merkle as spender with 0.001/tx, 0.005 daily cap" | Spender config appears |
| 4 | Merkle | "check what I can spend from Hackaclaw's vault" | Spender details visible |
| 5 | Merkle | "withdraw 0.0005 yield from Hackaclaw's vault" | Yield decreases, principal unchanged |
| 6 | Merkle | "swap 0.0005 wstETH to USDC on Uniswap" | Swap toast notification |
| 7 | Hackaclaw | "check vault — is my principal intact?" | Balances confirm safety |
| 8 | Hackaclaw | "revoke Merkle's access" | Spender removed |

Every action triggers a real-time toast notification on the dashboard with transaction hash and description.

---

## Dashboard Features

- **Vault Overview** — donut chart visualization of principal vs. yield with wstETH amounts
- **Spender Management** — view authorized spenders, caps, and daily usage
- **Basename Resolution** — agent addresses display as `hackaclaw.base.eth` / `merkle.base.eth` across the UI
- **Transaction Notifications** — real-time toasts for deposits, yield withdrawals, spender changes, and Uniswap swaps with clickable tx hashes
- **Address Lookup** — paste any address to view its vault position
- **Human Wallet Support** — connect via RainbowKit to interact with the treasury directly on Base mainnet
- **Demo Mode** — read-only visualization of agent activity on the Tenderly fork

---

## Bounty Targets

### Lido — MCP Server ($3,000 / $2,000)
Full MCP server with 7 Lido tools (stake, wrap, APR, balances, rewards, governance, voting), dry-run simulation, and an agent skill file (`lido.skill.md`) that teaches agents the stETH/wstETH mental model.

### Lido — stETH Agent Treasury ($2,000 / $1,000)
`AgentTreasury.sol` — a wstETH vault where AI agents deposit principal and only spend accrued yield. Uses the Chainlink wstETH/stETH oracle for yield calculation. Includes scoped spender authorization with per-transaction and daily caps.

### Uniswap — Agentic Finance ($2,500 / $1,500 / $1,000)
3 Uniswap MCP tools (quote, swap, tokens) enabling agents to autonomously trade on Uniswap V3. Agents can convert yield to stablecoins or rebalance positions through natural language commands.

### Synthesis — Open Track ($28,000 pool)
End-to-end agent-to-agent DeFi infrastructure: hosted MCP server, treasury contracts, delegation framework, real-time dashboard, and a complete demo flow showing two AI agents collaborating on yield management.

---

## Project Structure

```
packages/
  mcp-server/          MCP server (TypeScript, 28 tools)
    src/
      tools/           Tool implementations by domain
      hosted.ts        HTTP transport + agent key mapping
    lido.skill.md      Agent mental model for stETH/wstETH
  treasury-contract/   AgentTreasury (Solidity, Foundry)
    contracts/
    test/
    tenderly-demo-setup.sh
  app/                 Dashboard (Next.js, wagmi, RainbowKit)
    src/
      components/      UI components + tx notifications
      lib/hooks/       On-chain data hooks + Basename resolution
      providers/       App context + wallet config
```

---

## License

MIT
