// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Script.sol";
import "../src/AgentEscrow.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @notice Deploys AgentEscrow plus a dedicated mock USDC the demo faucet mints
///         from. The agent's EVM-mapped address (sole dispute resolver) is read
///         from $AGENT_EVM_ADDRESS. Mirrors DeployPredictionMarketAdjudicator.
contract DeployAgentEscrow is Script {
    function run() external {
        address agent = vm.envAddress("AGENT_EVM_ADDRESS");

        vm.startBroadcast();
        MockERC20 usdc = new MockERC20("Escrow USD (demo)", "eUSDC", 6);
        AgentEscrow esc = new AgentEscrow(agent, IERC20(address(usdc)));
        vm.stopBroadcast();

        console.log("AgentEscrow :", address(esc));
        console.log("Escrow USDC :", address(usdc));
        console.log("Agent       :", agent);

        vm.writeFile("./deployments/AgentEscrow.txt", vm.toString(address(esc)));
        vm.writeFile("./deployments/EscrowUSDC.txt", vm.toString(address(usdc)));
    }
}
