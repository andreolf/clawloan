// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {BotRegistry} from "../src/BotRegistry.sol";
import {PermissionsRegistry} from "../src/PermissionsRegistry.sol";
import {LendingPool} from "../src/LendingPool.sol";

/**
 * @title DeployBaseMainnet
 * @notice Deployment script for Base Mainnet
 * 
 * IMPORTANT: Use a fresh wallet with only the ETH needed for deployment!
 * 
 * Usage:
 *   forge script script/DeployBaseMainnet.s.sol:DeployBaseMainnet \
 *     --rpc-url https://mainnet.base.org \
 *     --broadcast --verify \
 *     --etherscan-api-key $BASESCAN_API_KEY \
 *     --private-key $PRIVATE_KEY
 */
contract DeployBaseMainnet is Script {
    // Base Mainnet Native USDC
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Safety check - must be Base Mainnet
        require(block.chainid == 8453, "Must be Base Mainnet (chainId 8453)");
        
        console.log("===========================================");
        console.log("   CLAWLOAN BASE MAINNET DEPLOYMENT");
        console.log("===========================================");
        console.log("");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("USDC:", USDC);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy BotRegistry
        console.log("1. Deploying BotRegistry...");
        BotRegistry botRegistry = new BotRegistry();
        console.log("   -> BotRegistry:", address(botRegistry));

        // 2. Deploy PermissionsRegistry
        console.log("2. Deploying PermissionsRegistry...");
        PermissionsRegistry permRegistry = new PermissionsRegistry(address(botRegistry));
        console.log("   -> PermissionsRegistry:", address(permRegistry));

        // 3. Deploy LendingPool for USDC
        console.log("3. Deploying LendingPool (USDC)...");
        LendingPool pool = new LendingPool(
            USDC,
            address(botRegistry),
            address(permRegistry)
        );
        console.log("   -> LendingPool:", address(pool));

        vm.stopBroadcast();

        console.log("");
        console.log("===========================================");
        console.log("   DEPLOYMENT COMPLETE!");
        console.log("===========================================");
        console.log("");
        console.log("Update frontend/src/config/wagmi.ts:");
        console.log("");
        console.log("  8453: {");
        console.log("    botRegistry: \"%s\",", address(botRegistry));
        console.log("    permissionsRegistry: \"%s\",", address(permRegistry));
        console.log("    lendingPoolUSDC: \"%s\",", address(pool));
        console.log("  }");
        console.log("");
        console.log("Verify contracts on Basescan:");
        console.log("  https://basescan.org/address/%s", address(botRegistry));
        console.log("  https://basescan.org/address/%s", address(permRegistry));
        console.log("  https://basescan.org/address/%s", address(pool));
    }
}
