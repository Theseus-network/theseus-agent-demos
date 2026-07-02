// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title SovereignVault
/// @notice A real LP vault for the Sovereign prediction-market fund.
///
///   - LP redemptions are automatic and permissionless: redeem() burns your
///     shares for a proportional slice of the assets during the monthly window.
///     No one has to approve it.
///   - The manager (the fund's operator) CANNOT withdraw LP funds. Its only
///     value-moving power is markLoss(), which sends assets to a burn address to
///     mark NAV down — it receives nothing. Gains are added by minting the
///     underlying into the vault. So there is no path for the manager to take
///     the pool.
///   - Admin changes (manager, fee recipient) require a 24h timelock, so any
///     change is announced a day ahead.
///   - Fees are charged for real: 2% a year management (accrued over time) and
///     20% performance above a high-water mark, minted as shares to the fee
///     recipient (diluting LPs by exactly the fee).
contract SovereignVault {
    // --- ERC20 shares ---
    string public name = "Sovereign Vault Share";
    string public symbol = "svUSDC";
    uint8 public immutable decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // --- Vault ---
    IERC20 public immutable asset;
    address public manager;
    address public feeRecipient;
    address public constant BURN = 0x000000000000000000000000000000000000dEaD;

    // --- Monthly redemption windows ---
    uint256 public immutable inception;
    uint256 public constant EPOCH = 30 days;
    uint256 public constant REDEEM_WINDOW = 5 days;

    // --- Fees ---
    // NAV per share is reported PRE-fee (the fund's gross performance). Fees
    // accrue as a separate liability (`feesOwed`) and are paid to the fee
    // recipient out of an LP's proceeds when they redeem.
    uint256 public constant MGMT_BPS = 200;   // 2% a year
    uint256 public constant PERF_BPS = 2000;  // 20% of profit
    uint256 public lastAccrue;
    uint256 public highWaterMark;             // gross NAV per 1e6 shares, 6dp
    uint256 public feesOwed;                  // accrued fees, in asset units

    // --- Timelock ---
    uint256 public constant TIMELOCK = 24 hours;
    address public pendingManager;
    uint256 public pendingManagerAt;
    address public pendingFeeRecipient;
    uint256 public pendingFeeRecipientAt;

    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
    event LossMarked(uint256 assets);
    event FeesCharged(uint256 mgmtAssets, uint256 perfAssets, uint256 feeShares);
    event ManagerProposed(address indexed to);
    event ManagerChanged(address indexed to);

    error ZeroAmount();
    error NotManager();
    error RedemptionsClosed();
    error Timelocked();

    modifier onlyManager() { if (msg.sender != manager) revert NotManager(); _; }

    constructor(IERC20 asset_, address manager_, address feeRecipient_) {
        asset = asset_;
        manager = manager_;
        feeRecipient = feeRecipient_;
        decimals = 6;
        inception = block.timestamp;
        lastAccrue = block.timestamp;
        highWaterMark = 1e6; // 1.00 to start
    }

    // --- Accounting ---
    function totalAssets() public view returns (uint256) { return asset.balanceOf(address(this)); }
    /// @notice Assets net of accrued fees — what LPs actually own.
    function netAssets() public view returns (uint256) { uint256 a = totalAssets(); return a > feesOwed ? a - feesOwed : 0; }

    // Deposits/redeems price at NET NAV, so LPs neither inherit nor forfeit fees.
    function convertToShares(uint256 assets) public view returns (uint256) { return (assets * (totalSupply + 1)) / (netAssets() + 1); }
    function convertToAssets(uint256 shares) public view returns (uint256) { return (shares * (netAssets() + 1)) / (totalSupply + 1); }
    function previewDeposit(uint256 assets) external view returns (uint256) { return convertToShares(assets); }
    function previewRedeem(uint256 shares) external view returns (uint256) { return convertToAssets(shares); }
    /// @notice GROSS NAV per share, pre-fee — the fund's performance.
    function pricePerShare() external view returns (uint256) { return (1e6 * (totalAssets() + 1)) / (totalSupply + 1); }
    /// @notice NET NAV per share, after accrued fees — the redeemable value.
    function netPricePerShare() external view returns (uint256) { return (1e6 * (netAssets() + 1)) / (totalSupply + 1); }

    // --- Redemption windows (automatic, permissionless) ---
    function redemptionsOpen() public view returns (bool) { return (block.timestamp - inception) % EPOCH < REDEEM_WINDOW; }
    function nextRedemptionOpen() public view returns (uint256) {
        uint256 into = (block.timestamp - inception) % EPOCH;
        return into < REDEEM_WINDOW ? block.timestamp : block.timestamp + (EPOCH - into);
    }
    function redemptionCloses() public view returns (uint256) {
        uint256 into = (block.timestamp - inception) % EPOCH;
        return into < REDEEM_WINDOW ? block.timestamp + (REDEEM_WINDOW - into) : 0;
    }

    // --- Fees ---
    /// @notice Charge accrued management + performance fees by minting shares to
    ///         the fee recipient. Permissionless (safe to call by anyone).
    function sync() public {
        uint256 supply = totalSupply;
        uint256 ta = totalAssets();
        if (supply == 0 || ta == 0) { lastAccrue = block.timestamp; return; }

        uint256 dt = block.timestamp - lastAccrue;
        uint256 mgmt = (ta * MGMT_BPS * dt) / (10000 * 365 days);

        uint256 grossPps = (1e6 * ta) / supply;
        uint256 perf = 0;
        if (grossPps > highWaterMark) {
            uint256 gain = ((grossPps - highWaterMark) * supply) / 1e6; // asset gain above HWM
            perf = (gain * PERF_BPS) / 10000;
            highWaterMark = grossPps;
        }

        feesOwed += mgmt + perf;
        if (feesOwed > ta) feesOwed = ta;
        lastAccrue = block.timestamp;
        if (mgmt + perf > 0) emit FeesCharged(mgmt, perf, 0);
    }

    // --- Deposit / redeem ---
    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        sync();
        shares = convertToShares(assets);
        require(asset.transferFrom(msg.sender, address(this), assets), "transferFrom failed");
        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function redeem(uint256 shares, address receiver) external returns (uint256 assets) {
        if (shares == 0) revert ZeroAmount();
        if (!redemptionsOpen()) revert RedemptionsClosed();
        sync();
        uint256 supply = totalSupply;
        assets = convertToAssets(shares);                  // net to the LP
        uint256 fee = (shares * feesOwed) / supply;        // their share of accrued fees
        _burn(msg.sender, shares);
        if (fee > 0) { feesOwed -= fee; require(asset.transfer(feeRecipient, fee), "fee transfer"); }
        require(asset.transfer(receiver, assets), "transfer failed");
        emit Withdraw(msg.sender, receiver, assets, shares);
    }

    // --- Manager: mark NAV only. No withdrawal path. ---
    /// @notice Mark the book down by burning assets to a dead address. The
    ///         manager receives nothing; it cannot move funds to itself.
    function markLoss(uint256 assets) external onlyManager {
        if (assets == 0) revert ZeroAmount();
        sync();
        uint256 ta = totalAssets();
        uint256 amt = assets > ta ? ta : assets;
        require(asset.transfer(BURN, amt), "burn failed");
        emit LossMarked(amt);
    }

    /// @notice Anyone can add assets to the vault (the settlement mints gains in
    ///         here), raising NAV for all shareholders.
    function fund(uint256 assets) external {
        require(asset.transferFrom(msg.sender, address(this), assets), "fund failed");
        sync();
    }

    // --- Timelocked admin changes (1-day notice) ---
    function proposeManager(address to) external onlyManager { pendingManager = to; pendingManagerAt = block.timestamp; emit ManagerProposed(to); }
    function acceptManager() external {
        if (pendingManager == address(0) || block.timestamp < pendingManagerAt + TIMELOCK) revert Timelocked();
        manager = pendingManager; pendingManager = address(0); emit ManagerChanged(manager);
    }
    function proposeFeeRecipient(address to) external onlyManager { pendingFeeRecipient = to; pendingFeeRecipientAt = block.timestamp; }
    function acceptFeeRecipient() external {
        if (pendingFeeRecipient == address(0) || block.timestamp < pendingFeeRecipientAt + TIMELOCK) revert Timelocked();
        feeRecipient = pendingFeeRecipient; pendingFeeRecipient = address(0);
    }

    // --- Minimal ERC20 ---
    function transfer(address to, uint256 amount) external returns (bool) { _transfer(msg.sender, to, amount); return true; }
    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; emit Approval(msg.sender, spender, amount); return true; }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        _transfer(from, to, amount); return true;
    }
    function _transfer(address from, address to, uint256 amount) internal { balanceOf[from] -= amount; balanceOf[to] += amount; emit Transfer(from, to, amount); }
    function _mint(address to, uint256 amount) internal { totalSupply += amount; balanceOf[to] += amount; emit Transfer(address(0), to, amount); }
    function _burn(address from, uint256 amount) internal { balanceOf[from] -= amount; totalSupply -= amount; emit Transfer(from, address(0), amount); }
}
