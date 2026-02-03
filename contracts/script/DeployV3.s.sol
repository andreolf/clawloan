// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/LendingPoolV3.sol";

/// @title DeployV3 - Deploy UUPS upgradeable LendingPoolV3
/// @notice Deploys implementation + proxy for upgradeable lending pool
contract DeployV3 is Script {
    // Base Mainnet addresses
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant BOT_REGISTRY = 0xE32404dB1720fFD9C00Afd392f9747d2043bC98A;
    address constant PERMISSIONS_REGISTRY = 0x41fe6bA7EEfcE0C248dA0426e8CcA8bd3C3B9eeb;
    address constant CREDIT_SCORING = 0x0E7d8675c4e0a0783B1B51eDe3aaB8D8BDc6B9Ad;
    address constant AGENT_VERIFICATION = 0xA8CE06014D60E4b7A93c4d6a79A3e40F88AB7F39;
    address constant ERC_8004_REGISTRY = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy implementation
        LendingPoolV3 implementation = new LendingPoolV3();
        console.log("Implementation deployed:", address(implementation));

        // 2. Encode initialization data
        bytes memory initData = abi.encodeWithSelector(
            LendingPoolV3.initialize.selector,
            USDC,
            BOT_REGISTRY,
            PERMISSIONS_REGISTRY
        );

        // 3. Deploy proxy pointing to implementation
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );
        console.log("Proxy deployed:", address(proxy));

        // 4. Configure the pool
        LendingPoolV3 pool = LendingPoolV3(address(proxy));
        pool.setCreditScoring(CREDIT_SCORING);
        pool.setAgentVerification(AGENT_VERIFICATION);
        pool.setERC8004Registry(ERC_8004_REGISTRY);
        
        // Enable Sybil prevention
        pool.setMinBotAge(7 days);
        pool.setRequire8004Attestation(true);
        pool.setEnforceCreditLimits(true);
        
        console.log("Pool configured with Sybil prevention enabled");
        console.log("Version:", pool.version());

        vm.stopBroadcast();
    }
}

/// @title UpgradeV3 - Upgrade existing proxy to new implementation
/// @notice For future upgrades - deploy new impl, call upgradeTo on proxy
contract UpgradeV3 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");
        
        vm.startBroadcast(deployerPrivateKey);

        // Deploy new implementation
        LendingPoolV3 newImplementation = new LendingPoolV3();
        console.log("New implementation:", address(newImplementation));

        // Upgrade proxy (must be called by owner)
        LendingPoolV3 proxy = LendingPoolV3(proxyAddress);
        proxy.upgradeToAndCall(address(newImplementation), "");
        
        console.log("Proxy upgraded to new implementation");
        console.log("Version:", proxy.version());

        vm.stopBroadcast();
    }
}
