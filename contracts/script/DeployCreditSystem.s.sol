// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/CreditScoring.sol";
import "../src/AgentVerification.sol";
import "../src/LendingPool.sol";

/// @title DeployCreditSystem - Deploy CreditScoring and AgentVerification
/// @notice Deploys to Base Sepolia and connects to existing LendingPool
contract DeployCreditSystem is Script {
    // Existing Base Sepolia addresses
    address constant BOT_REGISTRY = 0x69A52004c6D5dA2E42400ADE0A2E8869020bE931;
    address constant LENDING_POOL = 0x88EE97C470b275b3780972007d1Ba5Cf195A5DD9;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        console.log("Deploying Credit System to Base Sepolia...");
        console.log("Using BotRegistry:", BOT_REGISTRY);
        console.log("Using LendingPool:", LENDING_POOL);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy CreditScoring
        CreditScoring creditScoring = new CreditScoring(BOT_REGISTRY);
        console.log("CreditScoring deployed at:", address(creditScoring));

        // Deploy AgentVerification
        AgentVerification agentVerification = new AgentVerification(BOT_REGISTRY);
        console.log("AgentVerification deployed at:", address(agentVerification));

        // Authorize LendingPool to call CreditScoring
        creditScoring.authorizeCaller(LENDING_POOL);
        console.log("Authorized LendingPool to call CreditScoring");

        vm.stopBroadcast();

        console.log("");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("CreditScoring:", address(creditScoring));
        console.log("AgentVerification:", address(agentVerification));
        console.log("");
        console.log("NOTE: The existing LendingPool needs to be redeployed with");
        console.log("the new code to support setCreditScoring/setAgentVerification.");
        console.log("For now, these contracts are deployed and ready for a new pool.");
    }
}
