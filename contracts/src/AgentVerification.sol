// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import '@openzeppelin/contracts/access/Ownable.sol';
import './BotRegistry.sol';

/// @title AgentVerification - Identity verification for AI agents
/// @notice Manages verified agent status and integrates with external providers
/// @dev Can be extended to support multiple verification providers
contract AgentVerification is Ownable {
  // Verification levels
  uint256 public constant LEVEL_UNVERIFIED = 0;
  uint256 public constant LEVEL_BASIC = 1; // Self-attested
  uint256 public constant LEVEL_VERIFIED = 2; // Provider verified
  uint256 public constant LEVEL_TRUSTED = 3; // Multiple verifications

  struct Verification {
    uint256 level;
    address verifier; // Who verified (0x0 for self-attested)
    string provider; // Provider name (e.g., "openclaw", "attestation")
    bytes32 proofHash; // Hash of verification proof
    uint256 verifiedAt;
    uint256 expiresAt; // 0 = never expires
    bool active;
  }

  // Bot ID => Verification
  mapping(uint256 => Verification) public verifications;

  // Trusted verifiers
  mapping(address => bool) public trustedVerifiers;

  // Provider names for trusted verifiers
  mapping(address => string) public verifierNames;

  // Reference to bot registry
  BotRegistry public immutable botRegistry;

  // Verification requirements for borrowing
  bool public requireVerification = false;
  uint256 public minimumVerificationLevel = LEVEL_BASIC;

  // Events
  event AgentVerified(
    uint256 indexed botId,
    uint256 level,
    address indexed verifier,
    string provider
  );
  event VerificationRevoked(uint256 indexed botId, address indexed revoker);
  event VerifierAdded(address indexed verifier, string name);
  event VerifierRemoved(address indexed verifier);
  event RequirementUpdated(bool required, uint256 minimumLevel);

  // Errors
  error NotOperatorOrVerifier();
  error BotNotFound();
  error AlreadyVerified();
  error NotVerified();
  error VerificationExpired();
  error InsufficientVerificationLevel();
  error InvalidVerifier();

  constructor(address _botRegistry) Ownable(msg.sender) {
    botRegistry = BotRegistry(_botRegistry);
  }

  // ============ Verification Functions ============

  /// @notice Self-attest as a legitimate agent (basic verification)
  /// @param botId The bot to verify
  /// @param proofHash Hash of proof data (e.g., hash of code, description)
  function selfAttest(uint256 botId, bytes32 proofHash) external {
    // Verify caller is operator
    if (!botRegistry.isOperator(botId, msg.sender)) revert NotOperatorOrVerifier();

    Verification storage v = verifications[botId];

    // Can upgrade from unverified, but not downgrade
    if (v.level >= LEVEL_BASIC && v.active) revert AlreadyVerified();

    v.level = LEVEL_BASIC;
    v.verifier = address(0);
    v.provider = "self";
    v.proofHash = proofHash;
    v.verifiedAt = block.timestamp;
    v.expiresAt = 0; // Self-attestation doesn't expire
    v.active = true;

    emit AgentVerified(botId, LEVEL_BASIC, address(0), "self");
  }

  /// @notice Verify an agent (called by trusted verifiers)
  /// @param botId The bot to verify
  /// @param proofHash Hash of verification proof
  /// @param expiresAt When verification expires (0 = never)
  function verify(
    uint256 botId,
    bytes32 proofHash,
    uint256 expiresAt
  ) external {
    if (!trustedVerifiers[msg.sender]) revert InvalidVerifier();
    if (!botRegistry.isBotActive(botId)) revert BotNotFound();

    Verification storage v = verifications[botId];

    // Determine new level
    uint256 newLevel = LEVEL_VERIFIED;
    if (v.level == LEVEL_VERIFIED && v.verifier != msg.sender) {
      // Second verification from different verifier = TRUSTED
      newLevel = LEVEL_TRUSTED;
    }

    v.level = newLevel;
    v.verifier = msg.sender;
    v.provider = verifierNames[msg.sender];
    v.proofHash = proofHash;
    v.verifiedAt = block.timestamp;
    v.expiresAt = expiresAt;
    v.active = true;

    emit AgentVerified(botId, newLevel, msg.sender, verifierNames[msg.sender]);
  }

  /// @notice Revoke verification (by operator, verifier, or admin)
  /// @param botId The bot to revoke verification for
  function revokeVerification(uint256 botId) external {
    Verification storage v = verifications[botId];

    bool isOperator = botRegistry.isOperator(botId, msg.sender);
    bool isVerifier = v.verifier == msg.sender || trustedVerifiers[msg.sender];
    bool isOwner = msg.sender == owner();

    if (!isOperator && !isVerifier && !isOwner) revert NotOperatorOrVerifier();

    v.active = false;

    emit VerificationRevoked(botId, msg.sender);
  }

  // ============ View Functions ============

  /// @notice Check if a bot meets verification requirements
  /// @param botId The bot to check
  /// @return meets True if bot meets requirements
  function meetsRequirements(uint256 botId) external view returns (bool meets) {
    if (!requireVerification) return true;

    Verification storage v = verifications[botId];

    if (!v.active) return false;
    if (v.level < minimumVerificationLevel) return false;
    if (v.expiresAt > 0 && block.timestamp > v.expiresAt) return false;

    return true;
  }

  /// @notice Get verification level for a bot
  /// @param botId The bot to check
  /// @return level The verification level (0-3)
  function getVerificationLevel(
    uint256 botId
  ) external view returns (uint256 level) {
    Verification storage v = verifications[botId];

    if (!v.active) return LEVEL_UNVERIFIED;
    if (v.expiresAt > 0 && block.timestamp > v.expiresAt) return LEVEL_UNVERIFIED;

    return v.level;
  }

  /// @notice Check if a bot is verified at any level
  /// @param botId The bot to check
  /// @return verified True if verified and not expired
  function isVerified(uint256 botId) external view returns (bool verified) {
    Verification storage v = verifications[botId];

    if (!v.active) return false;
    if (v.expiresAt > 0 && block.timestamp > v.expiresAt) return false;

    return v.level >= LEVEL_BASIC;
  }

  /// @notice Get full verification details
  /// @param botId The bot to check
  function getVerification(
    uint256 botId
  )
    external
    view
    returns (
      uint256 level,
      address verifier,
      string memory provider,
      bytes32 proofHash,
      uint256 verifiedAt,
      uint256 expiresAt,
      bool active
    )
  {
    Verification storage v = verifications[botId];
    return (
      v.level,
      v.verifier,
      v.provider,
      v.proofHash,
      v.verifiedAt,
      v.expiresAt,
      v.active
    );
  }

  // ============ Admin Functions ============

  /// @notice Add a trusted verifier
  /// @param verifier Address of the verifier
  /// @param name Name of the verification provider
  function addVerifier(
    address verifier,
    string calldata name
  ) external onlyOwner {
    trustedVerifiers[verifier] = true;
    verifierNames[verifier] = name;
    emit VerifierAdded(verifier, name);
  }

  /// @notice Remove a trusted verifier
  /// @param verifier Address of the verifier
  function removeVerifier(address verifier) external onlyOwner {
    trustedVerifiers[verifier] = false;
    emit VerifierRemoved(verifier);
  }

  /// @notice Update verification requirements
  /// @param required Whether verification is required for borrowing
  /// @param minLevel Minimum verification level required
  function setRequirements(
    bool required,
    uint256 minLevel
  ) external onlyOwner {
    require(minLevel <= LEVEL_TRUSTED, "Invalid level");
    requireVerification = required;
    minimumVerificationLevel = minLevel;
    emit RequirementUpdated(required, minLevel);
  }
}
