// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/// @title VellumAuthor
/// @notice Commitment surface for a Vellum literary author agent. Each
///         Vellum has a permanent voice profile committed at mint and
///         anchored here. The agent signs every published piece and
///         every owner-edit-attempt refusal onto this contract.
///
///         Mirrors the PredictionMarketAdjudicator pattern: only the
///         agent address may write; decisions are PUBLISHED or REFUSED;
///         REFUSED is non-terminal (the owner may propose a different
///         edit later); the voiceProfileHash is immutable and binds
///         every record to the same voice.
///
///         The off-chain demo at /vellum primarily tests the refusal
///         path: an owner proposes an edit, the agent calls the LLM
///         against the voice profile, and either accepts (rare) or
///         refuses (common). Each refusal becomes a public record
///         under the voice profile hash.
contract VellumAuthor {
    enum Decision {
        UNINITIALIZED,
        PUBLISHED,
        REFUSED
    }

    /// @notice The Vellum agent's EVM-mapped address. Only this address can write.
    address public immutable agent;

    /// @notice keccak256 of the canonical voice-profile spec. Immutable —
    ///         the voice cannot be retuned after mint.
    bytes32 public immutable voiceProfileHash;

    /// @notice Human-readable description of the Vellum's catalog id (e.g. "Vellum 1492").
    string public description;

    struct Verdict {
        Decision decision;
        /// @notice keccak256 of the canonical piece body (PUBLISHED) or
        ///         the proposed edit + clause that was refused (REFUSED).
        bytes32 contentHash;
        /// @notice keccak256 of the off-chain reasoning blob.
        bytes32 reasonHash;
        uint256 updatedAt;
    }

    /// @notice Latest verdict per editId or pieceId.
    mapping(uint256 => Verdict) public verdicts;

    /// @notice Append-only log of every id the agent has ever posted on.
    uint256[] public touchedIds;

    event Published(uint256 indexed id, bytes32 contentHash, bytes32 reasonHash, uint256 updatedAt);
    event Refused(uint256 indexed id, bytes32 contentHash, bytes32 reasonHash, uint256 updatedAt);

    error NotAgent();
    error MissingContentHash();
    error MissingReasonHash();

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(address agent_, bytes32 voiceProfileHash_, string memory description_) {
        agent = agent_;
        voiceProfileHash = voiceProfileHash_;
        description = description_;
    }

    /// @notice Called by Vellum when it publishes a new piece.
    /// @param id Numeric id for the piece (off-chain assigned).
    /// @param contentHash keccak256 of the canonical piece body.
    /// @param reasonHash keccak256 of the off-chain reasoning blob.
    function publish(uint256 id, bytes32 contentHash, bytes32 reasonHash) external onlyAgent {
        if (contentHash == bytes32(0)) revert MissingContentHash();
        if (reasonHash == bytes32(0)) revert MissingReasonHash();

        bool firstTouch = verdicts[id].decision == Decision.UNINITIALIZED;
        verdicts[id] = Verdict({
            decision: Decision.PUBLISHED,
            contentHash: contentHash,
            reasonHash: reasonHash,
            updatedAt: block.timestamp
        });
        if (firstTouch) touchedIds.push(id);
        emit Published(id, contentHash, reasonHash, block.timestamp);
    }

    /// @notice Called by Vellum when it refuses an owner-proposed edit.
    /// @param id Numeric id for the edit attempt (off-chain assigned).
    /// @param contentHash keccak256 of the proposed edit body.
    /// @param reasonHash keccak256 of the off-chain refusal blob (which
    ///        clause of the voice profile was violated, etc.).
    function refuse(uint256 id, bytes32 contentHash, bytes32 reasonHash) external onlyAgent {
        if (contentHash == bytes32(0)) revert MissingContentHash();
        if (reasonHash == bytes32(0)) revert MissingReasonHash();

        bool firstTouch = verdicts[id].decision == Decision.UNINITIALIZED;
        verdicts[id] = Verdict({
            decision: Decision.REFUSED,
            contentHash: contentHash,
            reasonHash: reasonHash,
            updatedAt: block.timestamp
        });
        if (firstTouch) touchedIds.push(id);
        emit Refused(id, contentHash, reasonHash, block.timestamp);
    }

    /// @notice Non-reverting view; returns the full Verdict including its decision tag.
    function inspect(uint256 id) external view returns (Verdict memory) {
        return verdicts[id];
    }

    /// @notice Number of distinct ids the agent has ever posted on. Used by indexers.
    function touchedIdCount() external view returns (uint256) {
        return touchedIds.length;
    }
}
