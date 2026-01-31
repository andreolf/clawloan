// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {BotRegistry} from "../src/BotRegistry.sol";
import {PermissionsRegistry} from "../src/PermissionsRegistry.sol";
import {LendingPool} from "../src/LendingPool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TestBorrow is Script {
    // Base Sepolia addresses
    address constant USDC = 0x0af4619c2A7306BCE027AB5CFCB7f50AD2130321;
    address constant BOT_REGISTRY = 0x2F864Af26EEaA3EE5f2506c7BD22053657cda111;
    address constant PERMISSIONS_REGISTRY = 0xD39b7324ff77648b37e0E83949b9AE8e32dD2615;
    address constant LENDING_POOL = 0x88EE97C470b275b3780972007d1Ba5Cf195A5DD9;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("USDC balance:", IERC20(USDC).balanceOf(deployer));
        console.log("Pool USDC balance:", IERC20(USDC).balanceOf(LENDING_POOL));

        vm.startBroadcast(deployerPrivateKey);

        BotRegistry botRegistry = BotRegistry(BOT_REGISTRY);
        PermissionsRegistry permRegistry = PermissionsRegistry(PERMISSIONS_REGISTRY);
        LendingPool pool = LendingPool(LENDING_POOL);

        // 1. Register a bot
        console.log("\n--- Registering Bot ---");
        uint256 botId = botRegistry.registerBot(
            "ipfs://test-agent-metadata",
            deployer  // operator is the deployer
        );
        console.log("Registered bot ID:", botId);

        // 2. Set permissions for the bot
        console.log("\n--- Setting Permissions ---");
        bytes32 permHash = keccak256("clawloan:borrow");
        uint256 maxSpend = 10 * 1e6;  // 10 USDC max spend
        uint256 expiry = block.timestamp + 1 days;
        
        permRegistry.setPermissions(botId, permHash, maxSpend, expiry);
        console.log("Permissions set: maxSpend=10 USDC, expiry=1 day");

        // 3. Borrow some USDC
        console.log("\n--- Borrowing ---");
        uint256 borrowAmount = 1 * 1e6;  // 1 USDC
        
        console.log("Attempting to borrow:", borrowAmount / 1e6, "USDC");
        pool.borrow(botId, borrowAmount);
        console.log("Borrow successful!");

        // 4. Check balances
        console.log("\n--- After Borrow ---");
        console.log("Deployer USDC balance:", IERC20(USDC).balanceOf(deployer));
        console.log("Pool USDC balance:", IERC20(USDC).balanceOf(LENDING_POOL));
        console.log("Total borrows:", pool.totalBorrows());

        vm.stopBroadcast();
    }
}
