// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/AgentTreasury.sol";

contract DeployTreasury is Script {
    function run() external {
        // wstETH addresses per network
        address wstETH;
        uint256 chainId = block.chainid;

        if (chainId == 8453) {
            // Base mainnet (PRIMARY — cheapest gas, has wstETH + Uniswap)
            wstETH = 0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452;
        } else if (chainId == 1) {
            // Ethereum mainnet
            wstETH = 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0;
        } else if (chainId == 42161) {
            // Arbitrum
            wstETH = 0x5979D7b546E38E414F7E9822514be443A4800529;
        } else if (chainId == 17000) {
            // Holesky testnet
            wstETH = 0x8d09a4502Cc8Cf1547aD300E066060D043f6982D;
        } else {
            revert("Unsupported chain — use Base (8453), Mainnet (1), Arbitrum (42161), or Holesky (17000)");
        }

        vm.startBroadcast();
        AgentTreasury treasury = new AgentTreasury(wstETH);
        vm.stopBroadcast();

        console.log("AgentTreasury deployed at:", address(treasury));
        console.log("wstETH:", wstETH);
        console.log("Chain ID:", chainId);
    }
}
