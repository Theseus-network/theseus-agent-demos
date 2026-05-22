// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Script.sol";
import "../src/MarcellusCritic.sol";

contract DeployMarcellusCritic is Script {
    function run() external {
        address agent = vm.envAddress("AGENT_EVM_ADDRESS");
        bytes32 personaHash = vm.envBytes32("MARCELLUS_PERSONA_HASH");

        vm.startBroadcast();
        MarcellusCritic marcellus = new MarcellusCritic(
            agent,
            personaHash,
            "Marcellus (Theseus Agent music critic)"
        );
        vm.stopBroadcast();

        console.log("MarcellusCritic    :", address(marcellus));
        console.log("Writer agent       :", agent);
        console.logBytes32(personaHash);

        vm.writeFile("./deployments/MarcellusCritic.txt", vm.toString(address(marcellus)));
    }
}
