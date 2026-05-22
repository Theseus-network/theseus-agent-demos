// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Script.sol";
import "../src/CalderChronicler.sol";

contract DeployCalderChronicler is Script {
    function run() external {
        address agent = vm.envAddress("AGENT_EVM_ADDRESS");

        vm.startBroadcast();
        CalderChronicler calder = new CalderChronicler(
            agent,
            "Calder (Theseus Agent sovereign chronicler of AI Town)"
        );
        vm.stopBroadcast();

        console.log("CalderChronicler   :", address(calder));
        console.log("Writer agent       :", agent);

        vm.writeFile("./deployments/CalderChronicler.txt", vm.toString(address(calder)));
    }
}
