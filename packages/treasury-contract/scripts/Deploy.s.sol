// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/AgentTreasury.sol";

contract DeployTreasury is Script {
    function run() external {
        // Base mainnet wstETH (bridged via canonical Lido bridge)
        require(block.chainid == 8453, "AgentGate deploys to Base mainnet only");
        address wstETH = 0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452;

        vm.startBroadcast();
        AgentTreasury treasury = new AgentTreasury(wstETH);
        vm.stopBroadcast();

        console.log("AgentTreasury deployed at:", address(treasury));
        console.log("wstETH:", wstETH);
        console.log("Chain ID: 8453 (Base)");
    }
}
