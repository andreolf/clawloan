// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {BotRegistry} from "../src/BotRegistry.sol";
import {PermissionsRegistry} from "../src/PermissionsRegistry.sol";
import {LendingPool} from "../src/LendingPool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployOptimism
 * @notice Deployment script for Optimism Sepolia and Optimism Mainnet
 * 
 * Usage:
 * Optimism Sepolia:
 *   forge script script/DeployOptimism.s.sol:DeployOptimism \
 *     --rpc-url https://sepolia.optimism.io \
 *     --broadcast --private-key $PRIVATE_KEY
 * 
 * Optimism Mainnet:
 *   forge script script/DeployOptimism.s.sol:DeployOptimism \
 *     --rpc-url https://mainnet.optimism.io \
 *     --broadcast --private-key $PRIVATE_KEY
 */
contract DeployOptimism is Script {
    // Optimism Sepolia USDC (Circle)
    address constant USDC_SEPOLIA = 0x5fd84259d66Cd46123540766Be93DFE6D43130D7;
    
    // Optimism Mainnet USDC (Native)
    address constant USDC_MAINNET = 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85;
    
    // Optimism Mainnet USDT
    address constant USDT_MAINNET = 0x94b008aA00579c1307B0EF2c499aD98a8ce58e58;
    
    // Optimism Mainnet DAI
    address constant DAI_MAINNET = 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Detect network
        uint256 chainId = block.chainid;
        bool isTestnet = chainId == 11155420; // Optimism Sepolia
        
        console.log("=== Clawloan Optimism Deployment ===");
        console.log("Chain ID:", chainId);
        console.log("Network:", isTestnet ? "Optimism Sepolia" : "Optimism Mainnet");
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
