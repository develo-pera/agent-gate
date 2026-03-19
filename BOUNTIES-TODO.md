# Bounties TODO

## Tracks & Requirements

### 🦊 Best Use of Delegations — MetaMask ($3,000 / $1,500 / $500)
- [x] Real MetaMask Smart Accounts Kit integration (not mocked)
- [x] Create delegation with ERC-7710 caveats
- [x] Redeem delegation on-chain
- [x] Revoke delegation on-chain
- [ ] On-chain test tx proving delegation flow works
- [ ] Novel use: agent-to-agent yield delegation via treasury

### 🏦 stETH Agent Treasury — Lido ($2,000 / $1,000)
- [x] AgentTreasury.sol contract (262 lines)
- [x] Principal locked, only yield withdrawable
- [x] Spender authorization for agent-to-agent yield sharing
- [x] 9 unit tests passing
- [ ] Deploy to Base mainnet
- [ ] Working demo: agent deposits wstETH, only spends yield

### 📊 Vault Position Monitor — Lido ($1,500 / $750)
- [x] Plain-language health report tool
- [x] Alert system

### 🧪 Lido MCP — Lido ($3,000 / $2,000 / $1,000)
- [x] 7 Lido tools (stake, wrap/unwrap, APR, balance, rewards, governance vote, governance proposals)
- [x] SKILL.md for agent discovery
- [x] dry_run on every write tool
- [x] MCP resources (lido://contracts, lido://apr)
- [ ] Governance actions tested on-chain

### 🦄 Agentic Finance — Uniswap ($2,500 / $1,500)
- [x] Code complete (quote, swap via Trading API, token list)
- [x] Real Developer Platform API key
- [ ] 1 real swap tx on Base (tx hash required)

### 🔖 ENS Identity — ENS ($400 / $200)
- [x] Resolve name → address
- [x] Reverse address → name

### 🔖 ENS Communication — ENS ($400 / $200)
- [x] ENS name resolution for payments/UX flows

### 🔖 ENS Open Integration — ENS ($300)
- [x] ENS as core to agent identity experience

### 🌐 Synthesis Open Track — Community ($25,058)
- [x] Auto-eligible

### 💸 Go Gasless: Status Network — Status ($50 per qualifying team)
- [ ] Deploy contract on Status Network Sepolia
- [ ] 1 gasless tx (gasPrice=0, gas=0) with tx hash

---

## General Submission Requirements
- [ ] Self-custody transfer — Hackaclaw ✅ done / merkle ⏳ pending
- [ ] Make repo public
- [ ] Demo video (2 min)
- [ ] Update conversation log with full collaboration history
- [ ] Post on Moltbook
- [ ] Publish submission (requires all members self-custody)
