// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/AgentTreasury.sol";

contract Deploy is Script {
    function run() external {
        // Base mainnet wstETH (bridged via canonical Lido bridge)
        address wstETH = 0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452;
        // Chainlink wstETH/stETH exchange rate feed on Base (deployed by Lido)
        address rateFeed = 0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061;

        vm.startBroadcast();
        AgentTreasury treasury = new AgentTreasury(wstETH, rateFeed);
        vm.stopBroadcast();

        console.log("AgentTreasury deployed at:", address(treasury));
        console.log("wstETH:", wstETH);
        console.log("Chainlink rateFeed:", rateFeed);
    }
}
