#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# AgentTreasury Demo Setup — Anvil fork with real yield
#
# Creates a local Base fork where yield > 0 by depositing at an
# older block (lower Chainlink rate) then rolling to current block.
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

# Derive deployer address from private key
DEPLOYER=$(cast wallet address "$PRIVATE_KEY")
echo "Deployer: $DEPLOYER"

# Get current block
CURRENT_BLOCK=$(cast block-number --rpc-url "$BASE_RPC")
OLD_BLOCK=$((CURRENT_BLOCK - 2592000)) # ~60 days ago
echo "Current block: $CURRENT_BLOCK"
echo "Old block: $OLD_BLOCK"

# ── Phase 1: Fork at OLD block, deploy + deposit ────────────────
echo ""
echo "═══ Phase 1: Starting Anvil at old block $OLD_BLOCK ═══"
anvil --fork-url "$BASE_RPC" --fork-block-number "$OLD_BLOCK" --port 8545 &
ANVIL_PID=$!
sleep 3

# Check old Chainlink rate
OLD_RATE=$(cast call "$CHAINLINK_FEED" "latestRoundData()(uint80,int256,uint256,uint256,uint80)" --rpc-url "$ANVIL_RPC" | head -2 | tail -1)
echo "Old Chainlink rate: $OLD_RATE"

# Fund deployer with ETH for gas
cast rpc anvil_setBalance "$DEPLOYER" "0x56BC75E2D63100000" --rpc-url "$ANVIL_RPC" > /dev/null

# Deal wstETH to deployer (Anvil impersonation)
# We use anvil_setStorageAt on the wstETH ERC20 balanceOf mapping
# For OZ ERC20, balances are at slot 0: keccak256(abi.encode(address, 0))
BALANCE_SLOT=$(cast keccak "$(cast abi-encode 'f(address,uint256)' "$DEPLOYER" 0)")
WSTETH_AMOUNT="0x000000000000000000000000000000000000000000000000016345785D8A0000" # 0.1 ether
cast rpc anvil_setStorageAt "$WSTETH" "$BALANCE_SLOT" "$WSTETH_AMOUNT" --rpc-url "$ANVIL_RPC" > /dev/null

# Verify balance
BALANCE=$(cast call "$WSTETH" "balanceOf(address)(uint256)" "$DEPLOYER" --rpc-url "$ANVIL_RPC")
echo "Deployer wstETH balance: $BALANCE"

# Deploy the contract
echo "Deploying AgentTreasury..."
DEPLOY_OUTPUT=$(forge script scripts/Deploy.s.sol:Deploy \
  --rpc-url "$ANVIL_RPC" \
  --broadcast \
  --private-key "$PRIVATE_KEY" 2>&1)
TREASURY_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "AgentTreasury deployed at:" | awk '{print $NF}')
echo "Treasury deployed at: $TREASURY_ADDR"

# Approve + deposit wstETH
echo "Approving wstETH..."
cast send "$WSTETH" "approve(address,uint256)" "$TREASURY_ADDR" "$(cast max-uint)" \
  --rpc-url "$ANVIL_RPC" --private-key "$PRIVATE_KEY" > /dev/null

echo "Depositing 0.05 wstETH at old rate..."
cast send "$TREASURY_ADDR" "deposit(uint256)" "50000000000000000" \
  --rpc-url "$ANVIL_RPC" --private-key "$PRIVATE_KEY" > /dev/null

# Check vault status
echo "Vault status after deposit:"
cast call "$TREASURY_ADDR" "getVaultStatus(address)(uint256,uint256,uint256,bool)" "$DEPLOYER" --rpc-url "$ANVIL_RPC"

# Dump state
echo ""
echo "Dumping Anvil state..."
STATE=$(cast rpc anvil_dumpState --rpc-url "$ANVIL_RPC")
kill $ANVIL_PID 2>/dev/null
wait $ANVIL_PID 2>/dev/null || true
sleep 2

# ── Phase 2: Fork at CURRENT block, load old state ──────────────
echo ""
echo "═══ Phase 2: Starting Anvil at current block $CURRENT_BLOCK ═══"
anvil --fork-url "$BASE_RPC" --fork-block-number "$CURRENT_BLOCK" --port 8545 &
ANVIL_PID=$!
sleep 3

# Load the saved state (treasury contract + vault data persists)
echo "Loading saved state..."
cast rpc anvil_loadState "$STATE" --rpc-url "$ANVIL_RPC" > /dev/null

# Check current rate
CURRENT_RATE=$(cast call "$CHAINLINK_FEED" "latestRoundData()(uint80,int256,uint256,uint256,uint80)" --rpc-url "$ANVIL_RPC" | head -2 | tail -1)
echo "Current Chainlink rate: $CURRENT_RATE"
echo "Old Chainlink rate was: $OLD_RATE"

# Check vault — yield should be > 0
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
