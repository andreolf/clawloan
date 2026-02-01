// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CreditScoring} from "../src/CreditScoring.sol";
import {AgentVerification} from "../src/AgentVerification.sol";
import {LendingPool} from "../src/LendingPool.sol";

/// @title DeployCreditMainnet - Deploy CreditScoring and AgentVerification to Base Mainnet
contract DeployCreditMainnet is Script {
    // Already deployed on Base Mainnet
    address constant BOT_REGISTRY = 0xE32404dB1720fFD9C00Afd392f9747d2043bC98A;
    address constant LENDING_POOL = 0x8a184719997F77Ac315e08dCeDE74E3a9C19bd09;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        require(block.chainid == 8453, "Must be Base Mainnet");
        
        console.log("Deploying CreditScoring & AgentVerification to Base Mainnet...");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy CreditScoring
        CreditScoring creditScoring = new CreditScoring(BOT_REGISTRY);
        console.log("CreditScoring:", address(creditScoring));

        // Deploy AgentVerification
        AgentVerification agentVerification = new AgentVerification(BOT_REGISTRY);
        console.log("AgentVerification:", address(agentVerification));

        // Authorize LendingPool to call CreditScoring
        creditScoring.authorizeCaller(LENDING_POOL);
        console.log("Authorized LendingPool");

        // Connect to LendingPool
        LendingPool pool = LendingPool(LENDING_POOL);
        pool.setCreditScoring(address(creditScoring));
        pool.setAgentVerification(address(agentVerification));
        console.log("Connected to LendingPool");

        vm.stopBroadcast();

        console.log("");
        console.log("=== DONE ===");
        console.log("CreditScoring:", address(creditScoring));
        console.log("AgentVerification:", address(agentVerification));
    }
}
