// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {BotRegistry} from "../src/BotRegistry.sol";
import {PermissionsRegistry} from "../src/PermissionsRegistry.sol";
import {LendingPoolV3} from "../src/LendingPoolV3.sol";
import {CreditScoring} from "../src/CreditScoring.sol";
import {AgentVerification} from "../src/AgentVerification.sol";

/**
 * @title DeployEthereumMainnet
 * @notice Full deployment script for Ethereum Mainnet with V3 (UUPS upgradeable)
 * 
 * IMPORTANT: 
 * - Use a fresh wallet with only the ETH needed for deployment!
 * - Gas costs will be higher than L2s - monitor gas prices before deploying
 * - Consider deploying during low-activity periods (weekends, early morning UTC)
 * 
 * Usage:
 *   forge script script/DeployEthereumMainnet.s.sol:DeployEthereumMainnet \
 *     --rpc-url $ETH_RPC_URL \
 *     --broadcast --verify \
 *     --etherscan-api-key $ETHERSCAN_API_KEY \
 *     --private-key $PRIVATE_KEY
 * 
 * Dry run (recommended first):
 *   forge script script/DeployEthereumMainnet.s.sol:DeployEthereumMainnet \
 *     --rpc-url $ETH_RPC_URL \
 *     --private-key $PRIVATE_KEY
 */
contract DeployEthereumMainnet is Script {
    // Ethereum Mainnet USDC (Circle's native USDC)
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Safety check - must be Ethereum Mainnet
        require(block.chainid == 1, "Must be Ethereum Mainnet (chainId 1)");
        
        console.log("===========================================");
        console.log("   CLAWLOAN ETHEREUM MAINNET DEPLOYMENT");
        console.log("===========================================");
        console.log("");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Deployer balance:", deployer.balance / 1e18, "ETH");
        console.log("USDC:", USDC);
        console.log("");
        console.log("WARNING: This is ETHEREUM MAINNET!");
        console.log("Gas costs will be real. Proceeding in 3 seconds...");
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

        // 3. Deploy CreditScoring
        console.log("3. Deploying CreditScoring...");
        CreditScoring creditScoring = new CreditScoring(address(botRegistry));
        console.log("   -> CreditScoring:", address(creditScoring));

        // 4. Deploy AgentVerification
        console.log("4. Deploying AgentVerification...");
        AgentVerification agentVerification = new AgentVerification(address(botRegistry));
        console.log("   -> AgentVerification:", address(agentVerification));

        // 5. Deploy LendingPoolV3 (UUPS Upgradeable)
        console.log("5. Deploying LendingPoolV3 Implementation...");
        LendingPoolV3 implementation = new LendingPoolV3();
        console.log("   -> Implementation:", address(implementation));

        // 6. Deploy Proxy
        console.log("6. Deploying ERC1967 Proxy...");
        bytes memory initData = abi.encodeWithSelector(
            LendingPoolV3.initialize.selector,
            USDC,
            address(botRegistry),
            address(permRegistry)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );
        console.log("   -> Proxy (LendingPool):", address(proxy));

        // 7. Configure the pool
        console.log("7. Configuring LendingPoolV3...");
        LendingPoolV3 pool = LendingPoolV3(address(proxy));
        
        pool.setCreditScoring(address(creditScoring));
        pool.setAgentVerification(address(agentVerification));
        
        // Sybil prevention - slightly stricter for mainnet
        pool.setMinBotAge(7 days);
        pool.setEnforceCreditLimits(true);
        
        console.log("   -> Pool configured!");
        console.log("   -> Version:", pool.version());

        // 8. Connect CreditScoring to LendingPool
        console.log("8. Connecting CreditScoring...");
        creditScoring.authorizeCaller(address(proxy));
        console.log("   -> CreditScoring authorized!");

        vm.stopBroadcast();

        console.log("");
        console.log("===========================================");
        console.log("   DEPLOYMENT COMPLETE!");
        console.log("===========================================");
        console.log("");
        console.log("Contract Addresses:");
        console.log("-------------------------------------------");
        console.log("  BotRegistry:         ", address(botRegistry));
        console.log("  PermissionsRegistry: ", address(permRegistry));
        console.log("  CreditScoring:       ", address(creditScoring));
        console.log("  AgentVerification:   ", address(agentVerification));
        console.log("  LendingPoolV3 Impl:  ", address(implementation));
        console.log("  LendingPoolV3 Proxy: ", address(proxy));
        console.log("");
        console.log("Update frontend/src/config/wagmi.ts:");
        console.log("");
        console.log("  1: { // Ethereum Mainnet");
        console.log("    botRegistry: \"%s\",", address(botRegistry));
        console.log("    permissionsRegistry: \"%s\",", address(permRegistry));
        console.log("    lendingPoolUSDC: \"%s\",", address(proxy));
        console.log("    creditScoring: \"%s\",", address(creditScoring));
        console.log("    agentVerification: \"%s\",", address(agentVerification));
        console.log("  }");
        console.log("");
        console.log("Verify contracts on Etherscan:");
        console.log("  https://etherscan.io/address/%s#code", address(botRegistry));
        console.log("  https://etherscan.io/address/%s#code", address(permRegistry));
        console.log("  https://etherscan.io/address/%s#code", address(proxy));
        console.log("");
        console.log("NEXT STEPS:");
        console.log("  1. Verify all contracts on Etherscan");
        console.log("  2. Transfer ownership to multisig (if applicable)");
        console.log("  3. Seed initial liquidity");
        console.log("  4. Update frontend config");
        console.log("  5. Announce deployment!");
    }
}
