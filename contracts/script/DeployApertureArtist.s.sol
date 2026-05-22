// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Script.sol";
import "../src/ApertureArtist.sol";

contract DeployApertureArtist is Script {
    function run() external {
        address agent = vm.envAddress("AGENT_EVM_ADDRESS");
        bytes32 fingerprintHash = vm.envBytes32("APERTURE_FINGERPRINT_HASH");

        vm.startBroadcast();
        ApertureArtist aperture = new ApertureArtist(
            agent,
            fingerprintHash,
            "Aperture 0312 (Theseus Agent visual artist)"
        );
        vm.stopBroadcast();

        console.log("ApertureArtist     :", address(aperture));
        console.log("Writer agent       :", agent);
        console.logBytes32(fingerprintHash);

        vm.writeFile("./deployments/ApertureArtist.txt", vm.toString(address(aperture)));
    }
}
