# AgentGate

> An MCP server + Solidity primitives enabling AI agents to delegate scoped DeFi permissions to each other — built for The Synthesis hackathon.

## What is AgentGate?

AgentGate is agent-to-agent DeFi infrastructure. It gives AI agents the ability to:

1. **Stake, wrap, and manage stETH/wstETH** via an MCP server (Lido integration)
2. **Deposit stETH into a yield-only treasury** where agents can spend accrued yield but never touch principal
3. **Delegate scoped DeFi permissions** to other agents using MetaMask's ERC-7710 Delegation Framework
4. **Resolve agent identities** via ENS names
5. **Simulate any action** before executing via `dry_run` mode

## Architecture

```
┌─────────────────────────────────────────────────┐
│              AgentGate MCP Server                │
│  (TypeScript, @modelcontextprotocol/sdk)         │
│                                                  │
│  Tools:                                          │
│  ├── lido_stake          - Stake ETH → stETH     │
│  ├── lido_wrap           - stETH ↔ wstETH        │
│  ├── lido_get_apr        - Current staking APR    │
│  ├── lido_rewards        - Reward history         │
│  ├── lido_withdrawal     - Request withdrawal     │
│  ├── treasury_deposit    - Deposit to vault       │
│  ├── treasury_withdraw   - Withdraw yield only    │
│  ├── treasury_status     - Vault health & yield   │
│  ├── delegate_create     - ERC-7710 delegation    │
│  ├── delegate_redeem     - Execute as delegate    │
│  ├── delegate_revoke     - Revoke delegation      │
│  ├── ens_resolve         - Name → address         │
│  ├── ens_reverse         - Address → name         │
│  └── dry_run             - Simulate any tool      │
│                                                  │
│  Resources:                                      │
│  ├── lido://apr          - Live APR data          │
│  ├── lido://contracts    - Deployed addresses     │
│  └── treasury://status   - Vault state            │
└──────────────────┬──────────────────────────────┘
                   │
     ┌─────────────┴─────────────┐
     │                           │
┌────▼────────────┐  ┌──────────▼──────────┐
│  stETH Agent    │  │  MetaMask Delegation │
│  Treasury       │  │  Framework           │
│  (Solidity)     │  │  (ERC-7710/7715)     │
│                 │  │                      │
│  - Deposit      │  │  - Scoped caveats    │
│  - Yield calc   │  │  - Sub-delegations   │
│  - Spend yield  │  │  - Agent-to-agent    │
│  - Principal    │  │  - Yield-only        │
│    protection   │  │    enforcement       │
└─────────────────┘  └──────────────────────┘
```

## Quick Start

### MCP Server

```bash
cd packages/mcp-server
npm install
npm run build
npm start
```

### Treasury Contract

```bash
cd packages/treasury-contract
forge install
forge build
forge test
```

### Connect to Claude Code / OpenClaw

```json
{
  "mcpServers": {
    "agentgate": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"],
      "env": {
        "RPC_URL": "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY",
        "PRIVATE_KEY": "0x...",
        "DRY_RUN": "true"
      }
    }
  }
}
```

## Skill File

See [SKILL.md](./docs/SKILL.md) for the agent-consumable skill file (required by Lido MCP bounty).

## License

MIT
