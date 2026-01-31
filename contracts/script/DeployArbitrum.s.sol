// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {BotRegistry} from "../src/BotRegistry.sol";
import {PermissionsRegistry} from "../src/PermissionsRegistry.sol";
import {LendingPool} from "../src/LendingPool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployArbitrum
 * @notice Deployment script for Arbitrum Sepolia and Arbitrum One
 * 
 * Usage:
 * Arbitrum Sepolia:
 *   forge script script/DeployArbitrum.s.sol:DeployArbitrum \
 *     --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
 *     --broadcast --private-key $PRIVATE_KEY
 * 
 * Arbitrum One (mainnet):
 *   forge script script/DeployArbitrum.s.sol:DeployArbitrum \
 *     --rpc-url https://arb1.arbitrum.io/rpc \
 *     --broadcast --private-key $PRIVATE_KEY
 */
contract DeployArbitrum is Script {
    // Arbitrum Sepolia USDC (Circle)
    address constant USDC_SEPOLIA = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;
    
    // Arbitrum One USDC (Native)
    address constant USDC_MAINNET = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    
    // Arbitrum One USDT
    address constant USDT_MAINNET = 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9;
    
    // Arbitrum One DAI
    address constant DAI_MAINNET = 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Detect network
        uint256 chainId = block.chainid;
        bool isTestnet = chainId == 421614; // Arbitrum Sepolia
        
        console.log("=== Clawloan Arbitrum Deployment ===");
        console.log("Chain ID:", chainId);
        console.log("Network:", isTestnet ? "Arbitrum Sepolia" : "Arbitrum One");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy BotRegistry
        console.log("\n1. Deploying BotRegistry...");
        BotRegistry botRegistry = new BotRegistry();
        console.log("   BotRegistry:", address(botRegistry));

        // 2. Deploy PermissionsRegistry
        console.log("\n2. Deploying PermissionsRegistry...");
        PermissionsRegistry permRegistry = new PermissionsRegistry(address(botRegistry));
        console.log("   PermissionsRegistry:", address(permRegistry));

        // 3. Deploy LendingPool for USDC
        address usdcAddress = isTestnet ? USDC_SEPOLIA : USDC_MAINNET;
        console.log("\n3. Deploying LendingPool (USDC)...");
        console.log("   USDC address:", usdcAddress);
        
        LendingPool poolUSDC = new LendingPool(
            usdcAddress,
            address(botRegistry),
            address(permRegistry)
        );
        console.log("   LendingPool USDC:", address(poolUSDC));

        // 4. For mainnet, also deploy USDT and DAI pools
        if (!isTestnet) {
            console.log("\n4. Deploying LendingPool (USDT)...");
            LendingPool poolUSDT = new LendingPool(
                USDT_MAINNET,
                address(botRegistry),
                address(permRegistry)
            );
            console.log("   LendingPool USDT:", address(poolUSDT));

            console.log("\n5. Deploying LendingPool (DAI)...");
            LendingPool poolDAI = new LendingPool(
                DAI_MAINNET,
                address(botRegistry),
                address(permRegistry)
            );
            console.log("   LendingPool DAI:", address(poolDAI));
        }

        vm.stopBroadcast();

        console.log("\n=== Deployment Complete ===");
        console.log("Update frontend/src/config/wagmi.ts with:");
        console.log("  botRegistry:", address(botRegistry));
        console.log("  permissionsRegistry:", address(permRegistry));
        console.log("  lendingPoolUSDC:", address(poolUSDC));
    }
}
