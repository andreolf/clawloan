// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

import './BotRegistry.sol';

/// @title PermissionsRegistry - Scoped permissions for bot spending
/// @notice ERC-8004 aligned permissions registry for bot borrowing limits
/// @dev Stores permissions hash and max spend limits per bot
contract PermissionsRegistry is Ownable, ReentrancyGuard {
  struct Permission {
    bytes32 permissionsHash; // Hash of permission scope JSON (stored offchain)
    uint256 maxSpend; // Max borrow limit in USDC (6 decimals)
    uint256 expiry; // Delegation expiry timestamp (0 = no expiry)
    bool active; // Whether permissions are active
    uint256 updatedAt; // Last update timestamp
  }

  // Bot ID => Permission
  mapping(uint256 => Permission) public permissions;

  // Reference to bot registry
  BotRegistry public immutable botRegistry;

  // Events
  event PermissionsSet(
    uint256 indexed botId,
    bytes32 permissionsHash,
    uint256 maxSpend,
    uint256 expiry,
    uint256 timestamp
  );
  event PermissionsRevoked(uint256 indexed botId, uint256 timestamp);
  event MaxSpendUpdated(
    uint256 indexed botId,
    uint256 oldMaxSpend,
    uint256 newMaxSpend
  );

  // Errors
  error NotOperator();
  error BotNotActive();
  error PermissionsExpired();
  error PermissionsNotActive();
  error InvalidMaxSpend();

  constructor(address _botRegistry) Ownable(msg.sender) {
    botRegistry = BotRegistry(_botRegistry);
  }

  /// @notice Set permissions for a bot
  /// @param botId ID of the bot
  /// @param permissionsHash Hash of permission scope JSON
  /// @param maxSpend Maximum borrow limit in USDC
  /// @param expiry Expiry timestamp (0 = no expiry)
  function setPermissions(
    uint256 botId,
    bytes32 permissionsHash,
    uint256 maxSpend,
    uint256 expiry
  ) external nonReentrant {
    // Verify caller is the bot operator
    if (!botRegistry.isOperator(botId, msg.sender)) revert NotOperator();
    if (!botRegistry.isBotActive(botId)) revert BotNotActive();
    if (maxSpend == 0) revert InvalidMaxSpend();

    permissions[botId] = Permission({
      permissionsHash: permissionsHash,
      maxSpend: maxSpend,
      expiry: expiry,
      active: true,
      updatedAt: block.timestamp
    });

    emit PermissionsSet(
      botId,
      permissionsHash,
      maxSpend,
      expiry,
      block.timestamp
    );
  }

  /// @notice Revoke permissions for a bot (emergency revoke)
  /// @param botId ID of the bot
  function revokePermissions(uint256 botId) external {
    // Only operator or contract owner can revoke
    if (!botRegistry.isOperator(botId, msg.sender) && msg.sender != owner()) {
      revert NotOperator();
    }

    permissions[botId].active = false;
    permissions[botId].updatedAt = block.timestamp;

    emit PermissionsRevoked(botId, block.timestamp);
  }

  /// @notice Update max spend limit
  /// @param botId ID of the bot
  /// @param newMaxSpend New maximum spend limit
  function updateMaxSpend(uint256 botId, uint256 newMaxSpend) external {
    if (!botRegistry.isOperator(botId, msg.sender)) revert NotOperator();
    if (newMaxSpend == 0) revert InvalidMaxSpend();

    Permission storage perm = permissions[botId];
    uint256 oldMaxSpend = perm.maxSpend;
    perm.maxSpend = newMaxSpend;
    perm.updatedAt = block.timestamp;

    emit MaxSpendUpdated(botId, oldMaxSpend, newMaxSpend);
  }

  /// @notice Get permissions for a bot
  /// @param botId ID of the bot
  /// @return permissionsHash Hash of permission scope
  /// @return maxSpend Maximum spend limit
  /// @return expiry Expiry timestamp
  /// @return active Whether permissions are active
  function getPermissions(
    uint256 botId
  )
    external
    view
    returns (
      bytes32 permissionsHash,
      uint256 maxSpend,
      uint256 expiry,
      bool active
    )
  {
    Permission storage perm = permissions[botId];
    return (perm.permissionsHash, perm.maxSpend, perm.expiry, perm.active);
  }

  /// @notice Check if a bot has valid permissions
  /// @param botId ID of the bot
  /// @return True if permissions are valid and not expired
  function hasValidPermissions(uint256 botId) external view returns (bool) {
    Permission storage perm = permissions[botId];

    if (!perm.active) return false;
    if (perm.expiry > 0 && block.timestamp > perm.expiry) return false;

    return true;
  }

  /// @notice Check if a bot can spend a specific amount
  /// @param botId ID of the bot
  /// @param amount Amount to check
  /// @return True if bot can spend the amount
  function canSpend(
    uint256 botId,
    uint256 amount
  ) external view returns (bool) {
    Permission storage perm = permissions[botId];

    if (!perm.active) return false;
    if (perm.expiry > 0 && block.timestamp > perm.expiry) return false;
    if (amount > perm.maxSpend) return false;

    return true;
  }

  /// @notice Get remaining spend allowance for a bot
  /// @param botId ID of the bot
  /// @return Maximum spend limit (does not track used amount - that is in LendingPool)
  function getRemainingAllowance(
    uint256 botId
  ) external view returns (uint256) {
    Permission storage perm = permissions[botId];

    if (!perm.active) return 0;
    if (perm.expiry > 0 && block.timestamp > perm.expiry) return 0;

    return perm.maxSpend;
  }
}
