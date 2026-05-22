// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Script.sol";
import "../src/VellumAuthor.sol";

/// @notice Deploys the VellumAuthor commitment surface.
/// @dev    AGENT_EVM_ADDRESS — the agent's signing address.
///         VELLUM_VOICE_PROFILE_HASH — keccak256 of the canonical voice profile spec.
contract DeployVellumAuthor is Script {
    function run() external {
        address agent = vm.envAddress("AGENT_EVM_ADDRESS");
        bytes32 voiceProfileHash = vm.envBytes32("VELLUM_VOICE_PROFILE_HASH");

        vm.startBroadcast();
        VellumAuthor vellum = new VellumAuthor(
            agent,
            voiceProfileHash,
            "Vellum 1492 (Theseus Agent literary author)"
        );
        vm.stopBroadcast();

        console.log("VellumAuthor       :", address(vellum));
        console.log("Writer agent       :", agent);
        console.logBytes32(voiceProfileHash);

        vm.writeFile("./deployments/VellumAuthor.txt", vm.toString(address(vellum)));
    }
}
