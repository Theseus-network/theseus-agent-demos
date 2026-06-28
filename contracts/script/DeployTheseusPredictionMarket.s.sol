// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Script.sol";
import "../src/TheseusPredictionMarket.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @notice Deploys TheseusPredictionMarket on Base Sepolia, reusing the existing
///         eUSDC faucet token (set $PREDICT_USDC; defaults to the live escrow
///         eUSDC). The agent EOA (sole opener/resolver) is $AGENT_EVM_ADDRESS.
///         Then mints eUSDC to the agent and opens a starter set of markets so
///         the contract is tradeable immediately. Broadcast with the agent key.
///
///   AGENT_EVM_ADDRESS=0x... forge script script/DeployTheseusPredictionMarket.s.sol \
///     --rpc-url https://sepolia.base.org --broadcast --private-key $AGENT_PK
contract DeployTheseusPredictionMarket is Script {
    // The eUSDC faucet token already live on Base Sepolia (see deployments doc).
    address constant DEFAULT_USDC = 0x6aaBC0dBC77Bb5F79781D42E2F58F1312bEf607B;
    uint256 constant SEED = 2_000e6; // 2,000 eUSDC of starting liquidity per market

    function run() external {
        address agent = vm.envAddress("AGENT_EVM_ADDRESS");
        address usdcAddr = vm.envOr("PREDICT_USDC", DEFAULT_USDC);

        // Starter markets (ids match the app's agent-created board).
        uint256[] memory ids = new uint256[](21);
        for (uint256 i = 0; i < 21; i++) ids[i] = 5200 + i;

        vm.startBroadcast();
        TheseusPredictionMarket pm = new TheseusPredictionMarket(IERC20(usdcAddr), agent);

        // Fund the agent and open the starter markets (50/50 each).
        MockERC20(usdcAddr).mint(agent, SEED * ids.length);
        MockERC20(usdcAddr).approve(address(pm), type(uint256).max);
        for (uint256 i = 0; i < ids.length; i++) pm.openMarket(ids[i], SEED);
        vm.stopBroadcast();

        console.log("TheseusPredictionMarket:", address(pm));
        console.log("eUSDC                  :", usdcAddr);
        console.log("Agent                  :", agent);
        console.log("Markets opened         :", ids.length);

        vm.writeFile("./deployments/TheseusPredictionMarket.txt", vm.toString(address(pm)));
    }
}
