#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# AgentTreasury Demo Setup — Anvil fork with simulated yield
#
# Single-fork approach: fork at current block, deploy, deposit,
# then lower the vault's stored principalStETHValue to simulate
# yield accrual via the Chainlink oracle rate difference.
#
# Usage: ./demo-setup.sh <PRIVATE_KEY>
# Then point MCP server at RPC_URL=http://127.0.0.1:8545
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

PRIVATE_KEY="${1:?Usage: ./demo-setup.sh <PRIVATE_KEY>}"
BASE_RPC="https://mainnet.base.org"
ANVIL_RPC="http://127.0.0.1:8545"
WSTETH="0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452"
CHAINLINK_FEED="0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061"

# Derive deployer address
DEPLOYER=$(cast wallet address "$PRIVATE_KEY")
echo "Deployer: $DEPLOYER"

# ── Start Anvil fork at current block ────────────────────────────
echo ""
echo "═══ Starting Anvil fork at latest block ═══"
anvil --fork-url "$BASE_RPC" --port 8545 &
ANVIL_PID=$!
sleep 3

# Get current Chainlink rate
CURRENT_RATE_RAW=$(cast call "$CHAINLINK_FEED" "latestRoundData()(uint80,int256,uint256,uint256,uint80)" --rpc-url "$ANVIL_RPC")
CURRENT_RATE=$(echo "$CURRENT_RATE_RAW" | sed -n '2p' | awk '{print $1}')
echo "Current Chainlink wstETH/stETH rate: $CURRENT_RATE"

# Fund deployer with ETH
cast rpc anvil_setBalance "$DEPLOYER" "0x56BC75E2D63100000" --rpc-url "$ANVIL_RPC" > /dev/null

# Deal wstETH to deployer
# Base wstETH (bridged ERC-20) uses storage slot 1 for balances
BALANCE_SLOT=$(cast keccak "$(cast abi-encode 'f(address,uint256)' "$DEPLOYER" 1)")
WSTETH_AMOUNT="0x000000000000000000000000000000000000000000000000016345785D8A0000" # 0.1 wstETH
cast rpc anvil_setStorageAt "$WSTETH" "$BALANCE_SLOT" "$WSTETH_AMOUNT" --rpc-url "$ANVIL_RPC" > /dev/null

# Verify balance
BALANCE=$(cast call "$WSTETH" "balanceOf(address)(uint256)" "$DEPLOYER" --rpc-url "$ANVIL_RPC")
echo "Deployer wstETH balance: $BALANCE"

# Deploy the contract
echo ""
echo "═══ Deploying AgentTreasury ═══"
DEPLOY_OUTPUT=$(forge script scripts/Deploy.s.sol:Deploy \
  --rpc-url "$ANVIL_RPC" \
  --broadcast \
  --private-key "$PRIVATE_KEY" 2>&1)
TREASURY_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "AgentTreasury deployed at:" | awk '{print $NF}')
echo "Treasury deployed at: $TREASURY_ADDR"

# Approve + deposit
echo "Approving wstETH..."
cast send "$WSTETH" "approve(address,uint256)" "$TREASURY_ADDR" "$(cast max-uint)" \
  --rpc-url "$ANVIL_RPC" --private-key "$PRIVATE_KEY" > /dev/null

DEPOSIT_AMOUNT="50000000000000000" # 0.05 wstETH
echo "Depositing 0.05 wstETH..."
cast send "$TREASURY_ADDR" "deposit(uint256)" "$DEPOSIT_AMOUNT" \
  --rpc-url "$ANVIL_RPC" --private-key "$PRIVATE_KEY" > /dev/null

echo "Vault status after deposit:"
cast call "$TREASURY_ADDR" "getVaultStatus(address)(uint256,uint256,uint256,bool)" "$DEPLOYER" --rpc-url "$ANVIL_RPC"

# ── Simulate yield by lowering the stored principalStETHValue ────
# Vault struct in mapping(address => Vault) at slot 0:
#   slot+0 = principalWstETH
#   slot+1 = principalStETHValue
#   slot+2 = exists (bool)
echo ""
echo "═══ Simulating ~5% yield ═══"
# vaults mapping is at slot 1 (slot 0 is ReentrancyGuard._status)
VAULT_BASE=$(cast keccak "$(cast abi-encode 'f(address,uint256)' "$DEPLOYER" 1)")
STETH_VALUE_SLOT=$(python3 -c "print(hex(int('$VAULT_BASE', 16) + 1))")

# Read current principalStETHValue
CURRENT_PRINCIPAL_STETH=$(cast storage "$TREASURY_ADDR" "$STETH_VALUE_SLOT" --rpc-url "$ANVIL_RPC")
echo "Current principalStETHValue: $CURRENT_PRINCIPAL_STETH"

# Lower it by ~5% to simulate yield accrual
LOWER_VALUE=$(python3 -c "v = int('$CURRENT_PRINCIPAL_STETH', 16); print('0x' + hex(int(v * 0.95))[2:].zfill(64))")
echo "Setting principalStETHValue to: $LOWER_VALUE (~5% lower)"
cast rpc anvil_setStorageAt "$TREASURY_ADDR" "$STETH_VALUE_SLOT" "$LOWER_VALUE" --rpc-url "$ANVIL_RPC" > /dev/null

# Verify yield > 0
echo ""
echo "═══ Vault status (should show yield > 0) ═══"
cast call "$TREASURY_ADDR" "getVaultStatus(address)(uint256,uint256,uint256,bool)" "$DEPLOYER" --rpc-url "$ANVIL_RPC"

echo ""
echo "═══ Ready! ═══"
echo "Treasury: $TREASURY_ADDR"
echo "Deployer: $DEPLOYER"
echo "Anvil PID: $ANVIL_PID"
echo ""
echo "Set these in your .env:"
echo "  RPC_URL=http://127.0.0.1:8545"
echo "  TREASURY_ADDRESS=$TREASURY_ADDR"
echo "  PRIVATE_KEY=$PRIVATE_KEY"
echo ""
echo "To stop: kill $ANVIL_PID"
