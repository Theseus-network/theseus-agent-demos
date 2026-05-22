// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/// @title CalderChronicler
/// @notice Commitment surface for the Calder sovereign in-game
///         chronicler. Calder walks AI Town, witnesses events, and
///         files signed dispatches. Each dispatch anchors here under
///         the agent's key, so a stock-operator rewrite of the
///         centralized database can never re-sign as Calder. The
///         signature mismatch becomes the tamper signal.
///
///         Mirrors the PredictionMarketAdjudicator pattern. Dispatches
///         are append-only; there is no REFUSED state because Calder
///         is not a gate — it is a record. Tamper attempts are
///         detected off-chain by comparing the on-chain dispatchHash
///         to whatever the centralized row currently reads.
contract CalderChronicler {
    /// @notice The Calder agent's EVM-mapped address.
    address public immutable agent;

    string public description;

    struct Dispatch {
        /// @notice keccak256 of the canonical dispatch body.
        bytes32 dispatchHash;
        /// @notice keccak256 of the event report that prompted the dispatch.
        bytes32 eventHash;
        /// @notice keccak256 of the off-chain reasoning blob (structural claim, etc.).
        bytes32 reasonHash;
        uint256 updatedAt;
    }

    /// @notice Dispatch per id.
    mapping(uint256 => Dispatch) public dispatches;

    /// @notice Append-only log of every dispatch id.
    uint256[] public touchedIds;

    event Filed(
        uint256 indexed id,
        bytes32 dispatchHash,
        bytes32 eventHash,
        bytes32 reasonHash,
        uint256 updatedAt
    );

    error NotAgent();
    error MissingDispatchHash();
    error MissingEventHash();
    error MissingReasonHash();
    error AlreadyFiled(uint256 id);

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(address agent_, string memory description_) {
        agent = agent_;
        description = description_;
    }

    /// @notice File a signed dispatch on-chain.
    function file(
        uint256 id,
        bytes32 dispatchHash,
        bytes32 eventHash,
        bytes32 reasonHash
    ) external onlyAgent {
        if (dispatchHash == bytes32(0)) revert MissingDispatchHash();
        if (eventHash == bytes32(0)) revert MissingEventHash();
        if (reasonHash == bytes32(0)) revert MissingReasonHash();
        if (dispatches[id].dispatchHash != bytes32(0)) revert AlreadyFiled(id);

        dispatches[id] = Dispatch({
            dispatchHash: dispatchHash,
            eventHash: eventHash,
            reasonHash: reasonHash,
            updatedAt: block.timestamp
        });
        touchedIds.push(id);
        emit Filed(id, dispatchHash, eventHash, reasonHash, block.timestamp);
    }

    function inspect(uint256 id) external view returns (Dispatch memory) {
        return dispatches[id];
    }

    function touchedIdCount() external view returns (uint256) {
        return touchedIds.length;
    }
}
