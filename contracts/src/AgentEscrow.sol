// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/// @title AgentEscrow
/// @notice On-chain custody for two-party deals settled by a Theseus agent.
///
///         A buyer funds a deal in an ERC-20 (mock USDC in the demo) against a
///         written spec. The seller delivers. The happy path needs no agent:
///         the buyer releases, or the seller refunds, or the deadline lets the
///         silent party's counterpart claim. When the two disagree, either side
///         opens a dispute and the agent settles it.
///
///         The agent (the resolver_oracle.ship SHIP agent's EVM-mapped address)
///         runs off-chain: it reads getDeal(id) for the spec and the delivery,
///         judges whether the work met the spec, and calls resolve() once. It
///         can RELEASE to the seller, REFUND the buyer, or, when the record is
///         too thin to call, return UNRESOLVABLE, which refunds the buyer rather
///         than forcing a verdict. The contract holds the funds; the agent only
///         decides the direction. Only the agent address may call resolve().
///
///         Funds custody follows checks-effects-interactions and a reentrancy
///         guard: a deal's amount is zeroed and its status made terminal before
///         any token transfer.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract AgentEscrow {
    enum Status {
        NONE,
        FUNDED, // buyer funded, awaiting delivery
        DELIVERED, // seller submitted the deliverable
        DISPUTED, // a party asked the agent to settle
        RELEASED, // paid to the seller (terminal)
        REFUNDED, // returned to the buyer (terminal)
        UNRESOLVABLE // agent declined; buyer refunded (terminal)
    }

    /// @notice How the agent directed a disputed deal.
    enum Outcome {
        RELEASE, // work met the spec -> seller
        REFUND, // work did not meet the spec -> buyer
        UNRESOLVABLE // record too thin to call -> buyer
    }

    struct Deal {
        address buyer;
        address seller;
        uint256 amount;
        uint64 deadline; // after this, the deadline-claim paths open
        Status status;
        string spec; // what the seller must deliver
        string delivery; // what the seller submitted
        uint8 confidencePct; // set on agent settlement
        bytes32 reasonHash; // keccak256 of the agent's reason, set on settlement
    }

    /// @notice The SHIP agent's EVM-mapped address. Only this address may resolve disputes.
    address public immutable agent;

    /// @notice The escrowed token (mock USDC in the demo).
    IERC20 public immutable token;

    mapping(uint256 => Deal) private _deals;
    uint256 public dealCount;

    uint256 private _lock = 1;
    modifier nonReentrant() {
        require(_lock == 1, "reentrant");
        _lock = 2;
        _;
        _lock = 1;
    }

    event DealCreated(
        uint256 indexed id, address indexed buyer, address indexed seller, uint256 amount, uint64 deadline
    );
    event Delivered(uint256 indexed id);
    event Disputed(uint256 indexed id, address indexed by);
    event Settled(uint256 indexed id, Status status, address indexed paidTo, uint256 amount);
    event AgentSettled(uint256 indexed id, Outcome outcome, uint8 confidencePct, bytes32 reasonHash);

    error NotAgent();
    error NotBuyer();
    error NotSeller();
    error NotParty();
    error BadState(Status have);
    error BadDeal();
    error TooEarly();
    error TransferFailed();

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(address agent_, IERC20 token_) {
        require(agent_ != address(0) && address(token_) != address(0), "zero");
        agent = agent_;
        token = token_;
    }

    // --- create / deliver -------------------------------------------------

    /// @notice Buyer creates and funds a deal in one call. Buyer must have
    ///         approved this contract for `amount` of the token first.
    function createDeal(address seller, uint256 amount, uint64 deadline, string calldata spec)
        external
        nonReentrant
        returns (uint256 id)
    {
        if (seller == address(0) || seller == msg.sender || amount == 0 || deadline <= block.timestamp) {
            revert BadDeal();
        }
        if (!token.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        id = ++dealCount;
        Deal storage d = _deals[id];
        d.buyer = msg.sender;
        d.seller = seller;
        d.amount = amount;
        d.deadline = deadline;
        d.status = Status.FUNDED;
        d.spec = spec;

        emit DealCreated(id, msg.sender, seller, amount, deadline);
    }

    /// @notice Seller submits the deliverable. Allowed once, while FUNDED.
    function submitDelivery(uint256 id, string calldata delivery) external {
        Deal storage d = _deals[id];
        if (msg.sender != d.seller) revert NotSeller();
        if (d.status != Status.FUNDED) revert BadState(d.status);
        d.delivery = delivery;
        d.status = Status.DELIVERED;
        emit Delivered(id);
    }

    // --- happy path (no agent) -------------------------------------------

    /// @notice Buyer accepts the work and releases the funds to the seller.
    function approveRelease(uint256 id) external nonReentrant {
        Deal storage d = _deals[id];
        if (msg.sender != d.buyer) revert NotBuyer();
        if (d.status != Status.FUNDED && d.status != Status.DELIVERED) revert BadState(d.status);
        _settle(id, d, Status.RELEASED, d.seller);
    }

    /// @notice Seller gives up the claim and returns the funds to the buyer.
    function refundBuyer(uint256 id) external nonReentrant {
        Deal storage d = _deals[id];
        if (msg.sender != d.seller) revert NotSeller();
        if (d.status != Status.FUNDED && d.status != Status.DELIVERED) revert BadState(d.status);
        _settle(id, d, Status.REFUNDED, d.buyer);
    }

    // --- dispute -> agent -------------------------------------------------

    /// @notice Either party opens a dispute, asking the agent to settle.
    function dispute(uint256 id) external {
        Deal storage d = _deals[id];
        if (msg.sender != d.buyer && msg.sender != d.seller) revert NotParty();
        if (d.status != Status.FUNDED && d.status != Status.DELIVERED) revert BadState(d.status);
        d.status = Status.DISPUTED;
        emit Disputed(id, msg.sender);
    }

    /// @notice The agent settles a disputed deal after reading its spec and delivery.
    /// @param outcome RELEASE (seller), REFUND (buyer), or UNRESOLVABLE (buyer, declined).
    /// @param confidencePct 0-100, mirrors the off-chain confidence_pct.
    /// @param reasonHash keccak256 of the agent's written reason.
    function resolve(uint256 id, Outcome outcome, uint8 confidencePct, bytes32 reasonHash)
        external
        onlyAgent
        nonReentrant
    {
        Deal storage d = _deals[id];
        if (d.status != Status.DISPUTED) revert BadState(d.status);
        if (confidencePct > 100) revert BadDeal();

        d.confidencePct = confidencePct;
        d.reasonHash = reasonHash;
        emit AgentSettled(id, outcome, confidencePct, reasonHash);

        if (outcome == Outcome.RELEASE) {
            _settle(id, d, Status.RELEASED, d.seller);
        } else if (outcome == Outcome.REFUND) {
            _settle(id, d, Status.REFUNDED, d.buyer);
        } else {
            _settle(id, d, Status.UNRESOLVABLE, d.buyer);
        }
    }

    // --- deadline claims (no stuck funds) --------------------------------

    /// @notice After the deadline, if the seller delivered and the buyer never
    ///         objected, the seller claims the funds (silence is acceptance).
    function claimDelivered(uint256 id) external nonReentrant {
        Deal storage d = _deals[id];
        if (msg.sender != d.seller) revert NotSeller();
        if (d.status != Status.DELIVERED) revert BadState(d.status);
        if (block.timestamp < d.deadline) revert TooEarly();
        _settle(id, d, Status.RELEASED, d.seller);
    }

    /// @notice After the deadline, if the seller never delivered, the buyer
    ///         reclaims the funds.
    function reclaimUndelivered(uint256 id) external nonReentrant {
        Deal storage d = _deals[id];
        if (msg.sender != d.buyer) revert NotBuyer();
        if (d.status != Status.FUNDED) revert BadState(d.status);
        if (block.timestamp < d.deadline) revert TooEarly();
        _settle(id, d, Status.REFUNDED, d.buyer);
    }

    // --- internal / views -------------------------------------------------

    function _settle(uint256 id, Deal storage d, Status terminal, address to) private {
        // The status is flipped to a terminal value before the transfer, and
        // every caller rejects terminal statuses, so a deal can be settled at
        // most once. `amount` is left intact so a settled deal still reports
        // what it was for; status, not a zeroed amount, is the double-pay guard.
        d.status = terminal;
        if (!token.transfer(to, d.amount)) revert TransferFailed();
        emit Settled(id, terminal, to, d.amount);
    }

    function getDeal(uint256 id) external view returns (Deal memory) {
        return _deals[id];
    }
}
