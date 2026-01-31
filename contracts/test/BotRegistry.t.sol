// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import 'forge-std/Test.sol';
import '../src/BotRegistry.sol';

contract BotRegistryTest is Test {
  BotRegistry public registry;
  address public owner = makeAddr('owner');
  address public operator = makeAddr('operator');
  address public other = makeAddr('other');

  string constant METADATA_HASH = 'ipfs://QmTest123';
  string constant UPDATED_HASH = 'ipfs://QmTest456';

  event BotRegistered(
    uint256 indexed botId,
    address indexed operator,
    string metadataHash,
    uint256 timestamp
  );
  event BotUpdated(uint256 indexed botId, string metadataHash);
  event BotDeactivated(uint256 indexed botId);

  function setUp() public {
    vm.prank(owner);
    registry = new BotRegistry();
  }

  function test_RegisterBot() public {
    vm.prank(operator);
    uint256 botId = registry.registerBot(METADATA_HASH, operator);

    assertEq(botId, 1);

    (string memory hash, address op, uint256 regAt, bool active) = registry
      .getBot(botId);
    assertEq(hash, METADATA_HASH);
    assertEq(op, operator);
    assertGt(regAt, 0);
    assertTrue(active);
  }

  function test_RegisterBot_EmitsEvent() public {
    vm.expectEmit(true, true, false, true);
    emit BotRegistered(1, operator, METADATA_HASH, block.timestamp);

    vm.prank(operator);
    registry.registerBot(METADATA_HASH, operator);
  }

  function test_RegisterBot_IncrementsBotId() public {
    vm.startPrank(operator);
    uint256 id1 = registry.registerBot(METADATA_HASH, operator);
    uint256 id2 = registry.registerBot(METADATA_HASH, operator);
    vm.stopPrank();

    assertEq(id1, 1);
    assertEq(id2, 2);
  }

  function test_RegisterBot_RevertEmptyMetadata() public {
    vm.prank(operator);
    vm.expectRevert(BotRegistry.EmptyMetadata.selector);
    registry.registerBot('', operator);
  }

  function test_RegisterBot_RevertInvalidOperator() public {
    vm.prank(operator);
    vm.expectRevert(BotRegistry.InvalidOperator.selector);
    registry.registerBot(METADATA_HASH, address(0));
  }

  function test_UpdateBot() public {
    vm.prank(operator);
    uint256 botId = registry.registerBot(METADATA_HASH, operator);

    vm.prank(operator);
    registry.updateBot(botId, UPDATED_HASH);

    (string memory hash, , , ) = registry.getBot(botId);
    assertEq(hash, UPDATED_HASH);
  }

  function test_UpdateBot_RevertNotOperator() public {
    vm.prank(operator);
    uint256 botId = registry.registerBot(METADATA_HASH, operator);

    vm.prank(other);
    vm.expectRevert(BotRegistry.NotOperator.selector);
    registry.updateBot(botId, UPDATED_HASH);
  }

  function test_DeactivateBot() public {
    vm.prank(operator);
    uint256 botId = registry.registerBot(METADATA_HASH, operator);

    vm.prank(operator);
    registry.deactivateBot(botId);

    assertFalse(registry.isBotActive(botId));
  }

  function test_DeactivateBot_OwnerCanDeactivate() public {
    vm.prank(operator);
    uint256 botId = registry.registerBot(METADATA_HASH, operator);

    vm.prank(owner);
    registry.deactivateBot(botId);

    assertFalse(registry.isBotActive(botId));
  }

  function test_ReactivateBot() public {
    vm.prank(operator);
    uint256 botId = registry.registerBot(METADATA_HASH, operator);

    vm.prank(operator);
    registry.deactivateBot(botId);

    vm.prank(operator);
    registry.reactivateBot(botId);

    assertTrue(registry.isBotActive(botId));
  }

  function test_TransferOperator() public {
    vm.prank(operator);
    uint256 botId = registry.registerBot(METADATA_HASH, operator);

    vm.prank(operator);
    registry.transferOperator(botId, other);

    assertTrue(registry.isOperator(botId, other));
    assertFalse(registry.isOperator(botId, operator));
  }

  function test_GetBotsByOperator() public {
    vm.startPrank(operator);
    registry.registerBot(METADATA_HASH, operator);
    registry.registerBot(METADATA_HASH, operator);
    vm.stopPrank();

    uint256[] memory bots = registry.getBotsByOperator(operator);
    assertEq(bots.length, 2);
    assertEq(bots[0], 1);
    assertEq(bots[1], 2);
  }

  function test_Pause() public {
    vm.prank(owner);
    registry.pause();

    vm.prank(operator);
    vm.expectRevert();
    registry.registerBot(METADATA_HASH, operator);
  }

  function test_Unpause() public {
    vm.prank(owner);
    registry.pause();

    vm.prank(owner);
    registry.unpause();

    vm.prank(operator);
    uint256 botId = registry.registerBot(METADATA_HASH, operator);
    assertEq(botId, 1);
  }
}
