// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/**
 * @title ZeroPromptBilling
 * @notice Decentralized billing contract for ZeroPrompt AI platform
 * @dev Handles user deposits, credit management, and usage billing
 *
 * ████████╗███████╗██████╗  ██████╗ ██████╗ ██████╗  ██████╗ ███╗   ███╗██████╗ ████████╗
 * ╚══███╔╝██╔════╝██╔══██╗██╔═══██╗██╔══██╗██╔══██╗██╔═══██╗████╗ ████║██╔══██╗╚══███╔╝
 *   ███╔╝ █████╗  ██████╔╝██║   ██║██████╔╝██████╔╝██║   ██║██╔████╔██║██████╔╝  ███╔╝
 *  ███╔╝  ██╔══╝  ██╔══██╗██║   ██║██╔═══╝ ██╔══██╗██║   ██║██║╚██╔╝██║██╔═══╝  ███╔╝
 * ███████╗███████╗██║  ██║╚██████╔╝██║     ██║  ██║╚██████╔╝██║ ╚═╝ ██║██║     ███████╗
 * ╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚══════╝
 */
contract ZeroPromptBilling is Ownable, ReentrancyGuard, Pausable {

    // ═══════════════════════════════════════════════════════════════════════
    // STRUCTS
    // ═══════════════════════════════════════════════════════════════════════

    struct UserAccount {
        uint256 creditsUSD;          // Credits in USD (18 decimals, so 1 USD = 1e18)
        uint256 totalDeposited;      // Total native tokens deposited
        uint256 totalUsedUSD;        // Total USD spent
        uint256 depositCount;        // Number of deposits
        uint256 lastDepositTime;     // Timestamp of last deposit
        uint256 lastUsageTime;       // Timestamp of last usage
        bool isActive;               // Account status
    }

    struct Deposit {
        address user;
        uint256 amountNative;        // Amount in native token (wei)
        uint256 amountUSD;           // Amount in USD at time of deposit
        uint256 priceAtDeposit;      // Price of native token at deposit time
        uint256 timestamp;
        bytes32 txId;                // For tracking
    }

    struct UsageRecord {
        address user;
        uint256 amountUSD;           // Cost in USD
        string model;                // Model used
        uint256 inputTokens;
        uint256 outputTokens;
        uint256 timestamp;
        bytes32 requestId;           // For tracking
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════════════

    // Chainlink Price Feed
    AggregatorV3Interface public priceFeed;

    // User accounts
    mapping(address => UserAccount) public accounts;

    // Deposit history
    Deposit[] public deposits;
    mapping(address => uint256[]) public userDepositIds;

    // Usage history
    UsageRecord[] public usageRecords;
    mapping(address => uint256[]) public userUsageIds;

    // Operators (backend servers that can record usage)
    mapping(address => bool) public operators;

    // Config
    uint256 public minDepositUSD = 1e18;        // Minimum $1 USD deposit
    uint256 public freeCreditsUSD = 5e17;       // $0.50 free credits for new users
    uint256 public platformFeePercent = 0;      // Platform fee (0-100, default 0%)

    // Stats
    uint256 public totalDepositsUSD;
    uint256 public totalUsageUSD;
    uint256 public totalUsers;

    // Price staleness check (1 hour)
    uint256 public constant PRICE_STALENESS_THRESHOLD = 3600;

    // ═══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    event UserRegistered(address indexed user, uint256 freeCredits, uint256 timestamp);
    event CreditsDeposited(
        address indexed user,
        uint256 amountNative,
        uint256 amountUSD,
        uint256 priceUsed,
        uint256 newBalance,
        uint256 depositId
    );
    event CreditsUsed(
        address indexed user,
        uint256 amountUSD,
        string model,
        uint256 inputTokens,
        uint256 outputTokens,
        uint256 remainingBalance,
        bytes32 requestId
    );
    event CreditsRefunded(address indexed user, uint256 amountUSD, string reason);
    event OperatorUpdated(address indexed operator, bool status);
    event PriceFeedUpdated(address indexed newFeed);
    event ConfigUpdated(string param, uint256 value);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event FreeCreditsGranted(address indexed user, uint256 amount);

    // ═══════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════

    modifier onlyOperator() {
        require(operators[msg.sender] || msg.sender == owner(), "Not an operator");
        _;
    }

    modifier validPrice() {
        require(address(priceFeed) != address(0), "Price feed not set");
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════

    constructor(address _priceFeed) Ownable(msg.sender) {
        require(_priceFeed != address(0), "Invalid price feed");
        priceFeed = AggregatorV3Interface(_priceFeed);
        operators[msg.sender] = true;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // USER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function deposit() external payable nonReentrant whenNotPaused validPrice {
        require(msg.value > 0, "Must send value");

        uint256 nativePrice = getNativeTokenPrice();
        uint256 amountUSD = (msg.value * nativePrice) / 1e8;

        require(amountUSD >= minDepositUSD, "Below minimum deposit");

        if (!accounts[msg.sender].isActive) {
            _registerUser(msg.sender);
        }

        uint256 netAmountUSD = amountUSD;
        if (platformFeePercent > 0) {
            uint256 fee = (amountUSD * platformFeePercent) / 100;
            netAmountUSD = amountUSD - fee;
        }

        accounts[msg.sender].creditsUSD += netAmountUSD;
        accounts[msg.sender].totalDeposited += msg.value;
        accounts[msg.sender].depositCount++;
        accounts[msg.sender].lastDepositTime = block.timestamp;

        uint256 depositId = deposits.length;
        deposits.push(Deposit({
            user: msg.sender,
            amountNative: msg.value,
            amountUSD: netAmountUSD,
            priceAtDeposit: nativePrice,
            timestamp: block.timestamp,
            txId: keccak256(abi.encodePacked(msg.sender, msg.value, block.timestamp, depositId))
        }));
        userDepositIds[msg.sender].push(depositId);

        totalDepositsUSD += netAmountUSD;

        emit CreditsDeposited(
            msg.sender,
            msg.value,
            netAmountUSD,
            nativePrice,
            accounts[msg.sender].creditsUSD,
            depositId
        );
    }

    function getBalance(address user) external view returns (uint256 creditsUSD) {
        return accounts[user].creditsUSD;
    }

    function getAccount(address user) external view returns (UserAccount memory) {
        return accounts[user];
    }

    function getUserDeposits(address user) external view returns (uint256[] memory) {
        return userDepositIds[user];
    }

    function getUserUsage(address user) external view returns (uint256[] memory) {
        return userUsageIds[user];
    }

    // ═══════════════════════════════════════════════════════════════════════
    // OPERATOR FUNCTIONS (Backend)
    // ═══════════════════════════════════════════════════════════════════════

    function recordUsage(
        address user,
        uint256 amountUSD,
        string calldata model,
        uint256 inputTokens,
        uint256 outputTokens,
        bytes32 requestId
    ) external onlyOperator nonReentrant whenNotPaused {
        require(accounts[user].isActive, "User not registered");
        require(accounts[user].creditsUSD >= amountUSD, "Insufficient credits");

        accounts[user].creditsUSD -= amountUSD;
        accounts[user].totalUsedUSD += amountUSD;
        accounts[user].lastUsageTime = block.timestamp;

        uint256 usageId = usageRecords.length;
        usageRecords.push(UsageRecord({
            user: user,
            amountUSD: amountUSD,
            model: model,
            inputTokens: inputTokens,
            outputTokens: outputTokens,
            timestamp: block.timestamp,
            requestId: requestId
        }));
        userUsageIds[user].push(usageId);

        totalUsageUSD += amountUSD;

        emit CreditsUsed(
            user,
            amountUSD,
            model,
            inputTokens,
            outputTokens,
            accounts[user].creditsUSD,
            requestId
        );
    }

    function batchRecordUsage(
        address[] calldata users,
        uint256[] calldata amounts,
        string[] calldata models,
        bytes32[] calldata requestIds
    ) external onlyOperator nonReentrant whenNotPaused {
        require(
            users.length == amounts.length &&
            users.length == models.length &&
            users.length == requestIds.length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < users.length; i++) {
            if (accounts[users[i]].isActive && accounts[users[i]].creditsUSD >= amounts[i]) {
                accounts[users[i]].creditsUSD -= amounts[i];
                accounts[users[i]].totalUsedUSD += amounts[i];
                accounts[users[i]].lastUsageTime = block.timestamp;
                totalUsageUSD += amounts[i];

                emit CreditsUsed(
                    users[i],
                    amounts[i],
                    models[i],
                    0, 0,
                    accounts[users[i]].creditsUSD,
                    requestIds[i]
                );
            }
        }
    }

    function refundCredits(
        address user,
        uint256 amountUSD,
        string calldata reason
    ) external onlyOperator nonReentrant {
        require(accounts[user].isActive, "User not registered");
        accounts[user].creditsUSD += amountUSD;
        emit CreditsRefunded(user, amountUSD, reason);
    }

    function grantFreeCredits(
        address user,
        uint256 amountUSD
    ) external onlyOperator {
        if (!accounts[user].isActive) {
            _registerUser(user);
        }
        accounts[user].creditsUSD += amountUSD;
        emit FreeCreditsGranted(user, amountUSD);
    }

    function hasCredits(address user, uint256 amountUSD) external view returns (bool) {
        return accounts[user].isActive && accounts[user].creditsUSD >= amountUSD;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRICE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function getNativeTokenPrice() public view validPrice returns (uint256) {
        (
            uint80 roundId,
            int256 price,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();

        require(price > 0, "Invalid price");
        require(answeredInRound >= roundId, "Stale price");
        require(block.timestamp - updatedAt <= PRICE_STALENESS_THRESHOLD, "Price too old");

        return uint256(price);
    }

    function calculateCredits(uint256 amountNative) external view returns (uint256 amountUSD) {
        uint256 price = getNativeTokenPrice();
        return (amountNative * price) / 1e8;
    }

    function calculateDeposit(uint256 amountUSD) external view returns (uint256 amountNative) {
        uint256 price = getNativeTokenPrice();
        return (amountUSD * 1e8) / price;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function setOperator(address operator, bool status) external onlyOwner {
        operators[operator] = status;
        emit OperatorUpdated(operator, status);
    }

    function setPriceFeed(address newFeed) external onlyOwner {
        require(newFeed != address(0), "Invalid address");
        priceFeed = AggregatorV3Interface(newFeed);
        emit PriceFeedUpdated(newFeed);
    }

    function setMinDeposit(uint256 newMin) external onlyOwner {
        minDepositUSD = newMin;
        emit ConfigUpdated("minDepositUSD", newMin);
    }

    function setFreeCredits(uint256 newAmount) external onlyOwner {
        freeCreditsUSD = newAmount;
        emit ConfigUpdated("freeCreditsUSD", newAmount);
    }

    function setPlatformFee(uint256 newFee) external onlyOwner {
        require(newFee <= 100, "Fee too high");
        platformFeePercent = newFee;
        emit ConfigUpdated("platformFeePercent", newFee);
    }

    function withdraw(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid address");
        require(amount <= address(this).balance, "Insufficient balance");

        (bool success, ) = to.call{value: amount}("");
        require(success, "Transfer failed");

        emit FundsWithdrawn(to, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function _registerUser(address user) internal {
        accounts[user] = UserAccount({
            creditsUSD: freeCreditsUSD,
            totalDeposited: 0,
            totalUsedUSD: 0,
            depositCount: 0,
            lastDepositTime: 0,
            lastUsageTime: 0,
            isActive: true
        });

        totalUsers++;

        emit UserRegistered(user, freeCreditsUSD, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function getStats() external view returns (
        uint256 _totalUsers,
        uint256 _totalDepositsUSD,
        uint256 _totalUsageUSD,
        uint256 _contractBalance,
        uint256 _currentPrice
    ) {
        return (
            totalUsers,
            totalDepositsUSD,
            totalUsageUSD,
            address(this).balance,
            address(priceFeed) != address(0) ? getNativeTokenPrice() : 0
        );
    }

    function getDeposit(uint256 depositId) external view returns (Deposit memory) {
        require(depositId < deposits.length, "Invalid deposit ID");
        return deposits[depositId];
    }

    function getUsageRecord(uint256 usageId) external view returns (UsageRecord memory) {
        require(usageId < usageRecords.length, "Invalid usage ID");
        return usageRecords[usageId];
    }

    receive() external payable {}
}
