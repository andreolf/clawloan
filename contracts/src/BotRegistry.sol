// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/Pausable.sol';

/// @title BotRegistry - Registry for AI agent identities
/// @notice ERC-8004 aligned bot identity registry
/// @dev Stores bot metadata and operator addresses for the Moltloan protocol
contract BotRegistry is Ownable, ReentrancyGuard, Pausable {
  struct Bot {
    string metadataHash; // IPFS hash or URI to bot profile JSON
    address operator; // Who controls this bot
    uint256 registeredAt; // Timestamp of registration
    bool active; // Whether bot can borrow
  }

  // Bot ID => Bot data
  mapping(uint256 => Bot) public bots;

  // Operator => their bot IDs
  mapping(address => uint256[]) public operatorBots;

  // Next bot ID to assign
  uint256 public nextBotId;

  // Events
  event BotRegistered(
    uint256 indexed botId,
    address indexed operator,
    string metadataHash,
    uint256 timestamp
  );
  event BotUpdated(uint256 indexed botId, string metadataHash);
  event BotDeactivated(uint256 indexed botId);
  event BotReactivated(uint256 indexed botId);
  event OperatorTransferred(
    uint256 indexed botId,
    address indexed oldOperator,
    address indexed newOperator
  );

  // Errors
  error BotNotFound();
  error NotOperator();
  error BotNotActive();
  error InvalidOperator();
  error EmptyMetadata();

  constructor() Ownable(msg.sender) {
    nextBotId = 1; // Start from 1, 0 is reserved as invalid
  }

  /// @notice Register a new bot
  /// @param metadataHash IPFS hash or URI pointing to bot profile JSON
  /// @param operator Address that controls this bot
  /// @return botId The newly assigned bot ID
  function registerBot(
    string calldata metadataHash,
    address operator
  ) external whenNotPaused nonReentrant returns (uint256 botId) {
    if (operator == address(0)) revert InvalidOperator();
    if (bytes(metadataHash).length == 0) revert EmptyMetadata();

    botId = nextBotId++;

    bots[botId] = Bot({
      metadataHash: metadataHash,
      operator: operator,
      registeredAt: block.timestamp,
      active: true
    });

    operatorBots[operator].push(botId);

    emit BotRegistered(botId, operator, metadataHash, block.timestamp);
  }

  /// @notice Update bot metadata
  /// @param botId ID of the bot to update
  /// @param metadataHash New metadata hash
  function updateBot(
    uint256 botId,
    string calldata metadataHash
  ) external whenNotPaused {
    Bot storage bot = bots[botId];
    if (bot.registeredAt == 0) revert BotNotFound();
    if (bot.operator != msg.sender) revert NotOperator();
    if (bytes(metadataHash).length == 0) revert EmptyMetadata();

    bot.metadataHash = metadataHash;

    emit BotUpdated(botId, metadataHash);
  }

  /// @notice Deactivate a bot (prevents borrowing)
  /// @param botId ID of the bot to deactivate
  function deactivateBot(uint256 botId) external {
    Bot storage bot = bots[botId];
    if (bot.registeredAt == 0) revert BotNotFound();
    if (bot.operator != msg.sender && owner() != msg.sender)
      revert NotOperator();

    bot.active = false;

    emit BotDeactivated(botId);
  }

  /// @notice Reactivate a bot
  /// @param botId ID of the bot to reactivate
  function reactivateBot(uint256 botId) external {
    Bot storage bot = bots[botId];
    if (bot.registeredAt == 0) revert BotNotFound();
    if (bot.operator != msg.sender) revert NotOperator();

    bot.active = true;

    emit BotReactivated(botId);
  }

  /// @notice Transfer operator rights to a new address
  /// @param botId ID of the bot
  /// @param newOperator New operator address
  function transferOperator(uint256 botId, address newOperator) external {
    if (newOperator == address(0)) revert InvalidOperator();

    Bot storage bot = bots[botId];
    if (bot.registeredAt == 0) revert BotNotFound();
    if (bot.operator != msg.sender) revert NotOperator();

    address oldOperator = bot.operator;
    bot.operator = newOperator;

    // Update operator bot lists
    operatorBots[newOperator].push(botId);
    // Note: We do not remove from old operator list for gas efficiency
    // Frontend should filter by current operator

    emit OperatorTransferred(botId, oldOperator, newOperator);
  }

  /// @notice Get bot details
  /// @param botId ID of the bot
  /// @return metadataHash Bot metadata URI
  /// @return operator Bot operator address
  /// @return registeredAt Registration timestamp
  /// @return active Whether bot is active
  function getBot(
    uint256 botId
  )
    external
    view
    returns (
      string memory metadataHash,
      address operator,
      uint256 registeredAt,
      bool active
    )
  {
    Bot storage bot = bots[botId];
    if (bot.registeredAt == 0) revert BotNotFound();

    return (bot.metadataHash, bot.operator, bot.registeredAt, bot.active);
  }

  /// @notice Check if an address is the operator of a bot
  /// @param botId ID of the bot
  /// @param addr Address to check
  /// @return True if addr is the operator
  function isOperator(
    uint256 botId,
    address addr
  ) external view returns (bool) {
    return bots[botId].operator == addr;
  }

  /// @notice Check if a bot is active
  /// @param botId ID of the bot
  /// @return True if bot is active
  function isBotActive(uint256 botId) external view returns (bool) {
    Bot storage bot = bots[botId];
    return bot.registeredAt > 0 && bot.active;
  }

  /// @notice Get all bot IDs for an operator
  /// @param operator Address of the operator
  /// @return Array of bot IDs
  function getBotsByOperator(
    address operator
  ) external view returns (uint256[] memory) {
    return operatorBots[operator];
  }

  /// @notice Pause the registry (emergency)
  function pause() external onlyOwner {
    _pause();
  }

  /// @notice Unpause the registry
  function unpause() external onlyOwner {
    _unpause();
  }
}
