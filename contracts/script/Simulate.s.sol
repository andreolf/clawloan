// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import 'forge-std/Script.sol';
import '../src/MockUSDC.sol';
import '../src/BotRegistry.sol';
import '../src/PermissionsRegistry.sol';
import '../src/LendingPool.sol';
import '../src/ClawloanToken.sol';
import '../src/StakingModule.sol';

/// @title SimulateProtocol - Simulate full protocol flow
/// @notice Demonstrates Aave-like lending/borrowing with bot agents
contract SimulateProtocol is Script {
  MockUSDC public usdc;
  BotRegistry public botRegistry;
  PermissionsRegistry public permRegistry;
  LendingPool public pool;
  ClawloanToken public clawloan;
  StakingModule public staking;

  address public deployer;
  address public lender1;
  address public lender2;
  address public operator1;
  address public operator2;

  function run() external {
    deployer = vm.addr(vm.envUint('PRIVATE_KEY'));
    lender1 = makeAddr('lender1');
    lender2 = makeAddr('lender2');
    operator1 = makeAddr('operator1');
    operator2 = makeAddr('operator2');

    vm.startBroadcast(vm.envUint('PRIVATE_KEY'));

    // ============ Deploy Protocol ============
    console.log('=== Deploying Protocol ===');

    usdc = new MockUSDC();
    console.log('MockUSDC:', address(usdc));

    botRegistry = new BotRegistry();
    console.log('BotRegistry:', address(botRegistry));

    permRegistry = new PermissionsRegistry(address(botRegistry));
    console.log('PermissionsRegistry:', address(permRegistry));

    pool = new LendingPool(
      address(usdc),
      address(botRegistry),
      address(permRegistry)
    );
    console.log('LendingPool:', address(pool));

    clawloan = new ClawloanToken(deployer);
    console.log('ClawloanToken:', address(clawloan));

    staking = new StakingModule(address(clawloan), address(usdc));
    console.log('StakingModule:', address(staking));

    // Increase rate limit for simulation
    pool.setMaxBorrowPerBlock(1_000_000e6);

    vm.stopBroadcast();

    // ============ Setup Actors ============
    console.log('\n=== Setting Up Actors ===');

    // Fund lenders
    usdc.mint(lender1, 500_000e6);
    usdc.mint(lender2, 500_000e6);
    console.log('Funded lender1 with 500k USDC');
    console.log('Funded lender2 with 500k USDC');

    // Setup bots
    vm.prank(operator1);
    uint256 bot1 = botRegistry.registerBot('ipfs://arbitragebot', operator1);
    console.log('Registered ArbitrageBot ID:', bot1);

    vm.prank(operator2);
    uint256 bot2 = botRegistry.registerBot('ipfs://tradingbot', operator2);
    console.log('Registered TradingBot ID:', bot2);

    // Set permissions
    vm.prank(operator1);
    permRegistry.setPermissions(bot1, bytes32(0), 100_000e6, 0);

    vm.prank(operator2);
    permRegistry.setPermissions(bot2, bytes32(0), 50_000e6, 0);
    console.log('Set permissions for both bots');

    // Fund operators for repayment
    usdc.mint(operator1, 150_000e6);
    usdc.mint(operator2, 75_000e6);

    // ============ Simulate Lending ============
    console.log('\n=== Lenders Supply USDC ===');

    vm.prank(lender1);
    usdc.approve(address(pool), type(uint256).max);
    vm.prank(lender1);
    pool.deposit(300_000e6);
    console.log('Lender1 deposited 300k USDC');

    vm.prank(lender2);
    usdc.approve(address(pool), type(uint256).max);
    vm.prank(lender2);
    pool.deposit(200_000e6);
    console.log('Lender2 deposited 200k USDC');

    console.log('Total Deposits:', pool.totalDeposits() / 1e6, 'USDC');
    console.log('Utilization:', (pool.getUtilization() * 100) / 1e27, '%');

    // ============ Simulate Borrowing ============
    console.log('\n=== Bots Borrow USDC ===');

    vm.prank(operator1);
    usdc.approve(address(pool), type(uint256).max);
    vm.prank(operator1);
    pool.borrow(bot1, 50_000e6);
    console.log('Bot1 borrowed 50k USDC');

    vm.prank(operator2);
    usdc.approve(address(pool), type(uint256).max);
    vm.prank(operator2);
    pool.borrow(bot2, 25_000e6);
    console.log('Bot2 borrowed 25k USDC');

    console.log('Total Borrows:', pool.totalBorrows() / 1e6, 'USDC');
    console.log('Utilization:', (pool.getUtilization() * 100) / 1e27, '%');
    console.log('Borrow Rate:', (pool.getBorrowRate() * 100) / 1e27, '% APR');
    console.log('Supply Rate:', (pool.getSupplyRate() * 100) / 1e27, '% APY');

    // ============ Time Passes (30 days) ============
    console.log('\n=== 30 Days Pass ===');
    vm.warp(block.timestamp + 30 days);
    pool.accrueInterest();

    uint256 owed1 = pool.getAmountOwed(bot1);
    uint256 owed2 = pool.getAmountOwed(bot2);
    console.log('Bot1 owes:', owed1 / 1e6, 'USDC');
    console.log('Bot2 owes:', owed2 / 1e6, 'USDC');

    // ============ Simulate Repayment with Profit ============
    console.log('\n=== Bots Repay with Profit ===');

    // Bot1 made profit and repays
    vm.prank(operator1);
    pool.repayWithProfit(bot1, owed1, 5_000e6); // 5k profit
    console.log('Bot1 repaid with 5k USDC profit');

    // Bot2 repays without profit
    vm.prank(operator2);
    pool.repay(bot2, owed2);
    console.log('Bot2 repaid');

    console.log('Reward Pool:', pool.rewardPool() / 1e6, 'USDC');

    // ============ Lenders Withdraw ============
    console.log('\n=== Lenders Withdraw ===');

    (uint256 shares1, ) = pool.deposits(lender1);
    uint256 value1 = pool.getShareValue(shares1);
    console.log('Lender1 share value:', value1 / 1e6, 'USDC (deposited 300k)');

    (uint256 shares2, ) = pool.deposits(lender2);
    uint256 value2 = pool.getShareValue(shares2);
    console.log('Lender2 share value:', value2 / 1e6, 'USDC (deposited 200k)');

    vm.prank(lender1);
    pool.withdraw(shares1);
    console.log('Lender1 withdrew');

    vm.prank(lender2);
    pool.withdraw(shares2);
    console.log('Lender2 withdrew');

    // ============ Final State ============
    console.log('\n=== Final Protocol State ===');
    console.log('Total Deposits:', pool.totalDeposits() / 1e6, 'USDC');
    console.log('Total Borrows:', pool.totalBorrows() / 1e6, 'USDC');
    console.log('Reserves:', pool.reserves() / 1e6, 'USDC');
    console.log('Reward Pool:', pool.rewardPool() / 1e6, 'USDC');
    console.log(
      'Pool USDC Balance:',
      usdc.balanceOf(address(pool)) / 1e6,
      'USDC'
    );

    console.log('\n=== Simulation Complete ===');
  }
}
