// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Script.sol";
import "../src/QuillCoAuthor.sol";

contract DeployQuillCoAuthor is Script {
    function run() external {
        address agent = vm.envAddress("AGENT_EVM_ADDRESS");

        vm.startBroadcast();
        QuillCoAuthor quill = new QuillCoAuthor(
            agent,
            "Quill (Theseus Agent legal co-author with citation verification)"
        );
        vm.stopBroadcast();

        console.log("QuillCoAuthor      :", address(quill));
        console.log("Writer agent       :", agent);

        vm.writeFile("./deployments/QuillCoAuthor.txt", vm.toString(address(quill)));
    }
}
