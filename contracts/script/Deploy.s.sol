// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import 'forge-std/Script.sol';
import '../src/MockUSDC.sol';
import '../src/BotRegistry.sol';
import '../src/PermissionsRegistry.sol';
import '../src/LendingPool.sol';

/// @title Deploy - Deployment script for Moltloan contracts
/// @notice Deploys all core contracts and sets up initial configuration
contract Deploy is Script {
  function run() external {
    uint256 deployerPrivateKey = vm.envUint('PRIVATE_KEY');
    address deployer = vm.addr(deployerPrivateKey);

    console.log('Deploying Moltloan contracts...');
    console.log('Deployer:', deployer);

    vm.startBroadcast(deployerPrivateKey);

    // 1. Deploy MockUSDC (or use real USDC address on mainnet)
    MockUSDC usdc = new MockUSDC();
    console.log('MockUSDC deployed at:', address(usdc));

    // 2. Deploy BotRegistry
    BotRegistry botRegistry = new BotRegistry();
    console.log('BotRegistry deployed at:', address(botRegistry));

    // 3. Deploy PermissionsRegistry
    PermissionsRegistry permRegistry = new PermissionsRegistry(
      address(botRegistry)
    );
    console.log('PermissionsRegistry deployed at:', address(permRegistry));

    // 4. Deploy LendingPool
    LendingPool pool = new LendingPool(
      address(usdc),
      address(botRegistry),
      address(permRegistry)
    );
    console.log('LendingPool deployed at:', address(pool));

    // 5. Mint some test USDC to deployer for initial liquidity
    usdc.mint(deployer, 1_000_000e6); // 1M USDC
    console.log('Minted 1M USDC to deployer');

    vm.stopBroadcast();

    // Log deployment summary
    console.log('\n=== Deployment Summary ===');
    console.log('USDC:', address(usdc));
    console.log('BotRegistry:', address(botRegistry));
    console.log('PermissionsRegistry:', address(permRegistry));
    console.log('LendingPool:', address(pool));
  }
}

/// @title DeployMainnet - Mainnet deployment with real USDC
contract DeployMainnet is Script {
  // Base mainnet USDC
  address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

  function run() external {
    uint256 deployerPrivateKey = vm.envUint('PRIVATE_KEY');

    console.log('Deploying Moltloan contracts to Base mainnet...');

    vm.startBroadcast(deployerPrivateKey);

    // 1. Deploy BotRegistry
    BotRegistry botRegistry = new BotRegistry();
    console.log('BotRegistry deployed at:', address(botRegistry));

    // 2. Deploy PermissionsRegistry
    PermissionsRegistry permRegistry = new PermissionsRegistry(
      address(botRegistry)
    );
    console.log('PermissionsRegistry deployed at:', address(permRegistry));

    // 3. Deploy LendingPool with real USDC
    LendingPool pool = new LendingPool(
      USDC_BASE,
      address(botRegistry),
      address(permRegistry)
    );
    console.log('LendingPool deployed at:', address(pool));

    vm.stopBroadcast();
  }
}
