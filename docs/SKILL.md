# AgentGate Skill File

> Feed this file to your AI agent to give it Lido stETH, treasury management, and delegation capabilities.

## What is AgentGate?

AgentGate is an MCP server that gives AI agents the ability to:
- Stake ETH with Lido and manage stETH/wstETH
- Deposit stETH into a yield-only treasury (principal is protected)
- Delegate scoped DeFi permissions to other agents via MetaMask ERC-7710
- Resolve agent identities via ENS names
- Simulate any action before executing (dry_run mode)

## Setup

Connect to the AgentGate MCP server:

```json
{
  "mcpServers": {
    "agentgate": {
      "command": "node",
      "args": ["path/to/agentgate/packages/mcp-server/dist/index.js"],
      "env": {
        "RPC_URL": "https://ethereum-holesky-rpc.publicnode.com",
        "DRY_RUN": "true"
      }
    }
  }
}
```

Set `DRY_RUN=false` and add `PRIVATE_KEY` to execute real transactions.

## Available Tools

### Lido stETH Operations

| Tool | Description | Key Params |
|------|-------------|------------|
| `lido_stake` | Stake ETH → receive stETH | `amount_eth`, `dry_run` |
| `lido_wrap` | Convert stETH ↔ wstETH | `direction` (wrap/unwrap), `amount` |
| `lido_get_apr` | Get current staking APR | none |
| `lido_balance` | Check stETH/wstETH balances | `address` |
| `lido_rewards` | Fetch reward history | `address`, `limit` |

### Agent Treasury (Yield-Only Vault)

| Tool | Description | Key Params |
|------|-------------|------------|
| `treasury_deposit` | Deposit wstETH (principal locked) | `amount_wsteth` |
| `treasury_withdraw_yield` | Withdraw accrued yield only | `recipient`, `amount_wsteth` |
| `treasury_status` | Check vault health & yield | `agent_address` |
| `treasury_authorize_spender` | Let another agent spend your yield | `spender`, `yield_only` |

### Delegations (MetaMask ERC-7710)

| Tool | Description | Key Params |
|------|-------------|------------|
| `delegate_create` | Grant scoped permission to another agent | `delegate`, `caveats[]` |
| `delegate_redeem` | Execute action using a delegation | `delegator`, `target_contract`, `function_name` |
| `delegate_revoke` | Revoke a delegation | `delegate` |

### ENS Identity

| Tool | Description | Key Params |
|------|-------------|------------|
| `ens_resolve` | ENS name → address | `name` |
| `ens_reverse` | Address → ENS name | `address` |

## Common Workflows

### 1. Stake ETH and check yield

```
1. lido_stake(amount_eth: "1.0", dry_run: true)    → simulate
2. lido_stake(amount_eth: "1.0")                    → execute
3. lido_wrap(direction: "wrap", amount: "1.0")      → wrap to wstETH
4. lido_get_apr()                                    → check current APR
```

### 2. Deposit to treasury and delegate yield spending

```
1. treasury_deposit(amount_wsteth: "1.0")           → lock principal
2. treasury_status(agent_address: "0x...")           → check yield
3. treasury_authorize_spender(spender: "0xAgent2", yield_only: true)
4. Agent2 can now call treasury_withdraw_yield on your behalf
```

### 3. Create a delegation for another agent

```
1. delegate_create(
     delegate: "0xAgent2",
     caveats: [
       { type: "yield_only", params: { treasury: "0xTreasury" } },
       { type: "amount_limit", params: { max_amount: "0.5" } }
     ]
   )
2. Agent2 calls delegate_redeem(...) to act within those constraints
```

### 4. Resolve agent identity

```
1. ens_resolve(name: "myagent.eth")  → get address
2. ens_reverse(address: "0x...")      → get ENS name
```

## Resources (auto-updated)

| URI | Description |
|-----|-------------|
| `lido://contracts` | Deployed Lido contract addresses |
| `lido://apr` | Live staking APR data |

## Dry Run Mode

Every write tool supports `dry_run: true`. This simulates the action and returns:
- Estimated outputs (stETH received, yield available, etc.)
- The exact contract calls that would be made
- Whether the action would succeed

Always use dry_run first when exploring unfamiliar operations.

## Networks

- **Mainnet**: Set `CHAIN=mainnet` — uses production Lido contracts
- **Holesky** (default): Testnet with full Lido deployment — safe for testing
- **Status Sepolia**: Treasury contract also deployed for gasless testing

## Source

- GitHub: [github.com/your-repo/agentgate](https://github.com/your-repo/agentgate)
- License: MIT
