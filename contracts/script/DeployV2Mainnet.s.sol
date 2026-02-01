// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LendingPoolV2} from "../src/LendingPoolV2.sol";

contract DeployV2Mainnet is Script {
    // Existing mainnet addresses
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant BOT_REGISTRY = 0xE32404dB1720fFD9C00Afd392f9747d2043bC98A;
    address constant PERMISSIONS_REGISTRY = 0x78330e61039dF1154D48344c88C37f92afa8a11A;
    address constant CREDIT_SCORING = 0x0E7d8675c4e0a0783B1B51eDe3aaB8D8BDc6B9Ad;
    address constant AGENT_VERIFICATION = 0x8C33d30Dc86F032EFb77A9CB0A740fDCE6df04fC;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        require(block.chainid == 8453, "Must be Base Mainnet");

        console.log("Deploying LendingPoolV2 to Base Mainnet...");
        console.log("USDC:", USDC);
        console.log("BotRegistry:", BOT_REGISTRY);
        console.log("PermissionsRegistry:", PERMISSIONS_REGISTRY);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy LendingPoolV2
        LendingPoolV2 pool = new LendingPoolV2(
            USDC,
            BOT_REGISTRY,
            PERMISSIONS_REGISTRY
        );
        console.log("LendingPoolV2:", address(pool));

        // Connect credit scoring and verification
        pool.setCreditScoring(CREDIT_SCORING);
        pool.setAgentVerification(AGENT_VERIFICATION);
        console.log("Connected CreditScoring and AgentVerification");

        // Set max loan duration to 7 days (default)
        // pool.setMaxLoanDuration(7 days); // Already default

        vm.stopBroadcast();

        console.log("");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("LendingPoolV2:", address(pool));
        console.log("");
        console.log("Next steps:");
        console.log("1. Authorize LendingPoolV2 in CreditScoring");
        console.log("2. Update frontend config with new address");
        console.log("3. Deposit liquidity");
    }
}
