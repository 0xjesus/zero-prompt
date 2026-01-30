// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title OperatorRegistry
 * @notice Manages operator registration, staking, and performance metrics for ZeroPrompt subnet
 * @dev Operators register with an endpoint and models, then stake ZEROP to participate
 */
contract OperatorRegistry is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    uint256 public constant MIN_STAKE_AMOUNT = 1_000 ether; // 1,000 ZEROP
    uint256 public constant SLASH_PERCENTAGE = 10; // 10% per infraction
    uint256 public constant UNSTAKE_DELAY = 7 days;
    uint256 public constant MAX_PERFORMANCE_SCORE = 100;

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    IERC20 public immutable zeropToken;
    address public rewardsContract;

    struct OperatorInfo {
        string endpoint;
        string[] supportedModels;
        bool isRegistered;
        uint256 registeredAt;
        uint256 lastUpdated;
    }

    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
        uint256 lastRewardClaim;
        uint256 pendingUnstake;
        uint256 unstakeRequestedAt;
    }

    struct PerformanceMetrics {
        uint256 totalRequests;
        uint256 successfulRequests;
        uint256 totalLatencyMs;
        uint256 lastActiveAt;
        uint256 uptimeChecksPassed;
        uint256 uptimeChecksTotal;
        uint256 slashCount;
    }

    mapping(address => OperatorInfo) public operators;
    mapping(address => StakeInfo) public stakes;
    mapping(address => PerformanceMetrics) public metrics;

    // Active operators list for efficient iteration
    address[] private _activeOperators;
    mapping(address => uint256) private _activeOperatorIndex; // operator => index + 1 (0 means not in list)

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event OperatorRegistered(address indexed operator, string endpoint);
    event EndpointUpdated(address indexed operator, string oldEndpoint, string newEndpoint);
    event SupportedModelsUpdated(address indexed operator, string[] models);
    event Staked(address indexed operator, uint256 amount);
    event UnstakeRequested(address indexed operator, uint256 amount, uint256 availableAt);
    event Unstaked(address indexed operator, uint256 amount);
    event StakeIncreased(address indexed operator, uint256 additionalAmount, uint256 newTotal);
    event MetricsUpdated(address indexed operator, uint256 requests, uint256 successRate, uint256 avgLatency);
    event OperatorSlashed(address indexed operator, uint256 slashedAmount, string reason);
    event RewardsContractUpdated(address oldContract, address newContract);
    event OperatorActivated(address indexed operator);
    event OperatorDeactivated(address indexed operator);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error NotRegistered();
    error AlreadyRegistered();
    error InsufficientStake();
    error AlreadyStaked();
    error NotStaked();
    error UnstakeNotRequested();
    error UnstakeDelayNotPassed();
    error InvalidAmount();
    error InvalidEndpoint();
    error EmptyModels();
    error InvalidRewardsContract();
    error OnlyRewardsContract();
    error OperatorNotActive();

    // ═══════════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════════

    modifier onlyRegistered() {
        if (!operators[msg.sender].isRegistered) revert NotRegistered();
        _;
    }

    modifier onlyRewards() {
        if (msg.sender != rewardsContract) revert OnlyRewardsContract();
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    constructor(address _zeropToken) Ownable(msg.sender) {
        zeropToken = IERC20(_zeropToken);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // OPERATOR REGISTRATION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Register as an operator with endpoint and supported models
     * @param endpoint The HTTPS endpoint for the Ollama node
     * @param supportedModels List of model IDs the node supports
     */
    function registerOperator(
        string calldata endpoint,
        string[] calldata supportedModels
    ) external {
        if (operators[msg.sender].isRegistered) revert AlreadyRegistered();
        if (bytes(endpoint).length == 0) revert InvalidEndpoint();
        if (supportedModels.length == 0) revert EmptyModels();

        operators[msg.sender] = OperatorInfo({
            endpoint: endpoint,
            supportedModels: supportedModels,
            isRegistered: true,
            registeredAt: block.timestamp,
            lastUpdated: block.timestamp
        });

        emit OperatorRegistered(msg.sender, endpoint);
    }

    /**
     * @notice Update the endpoint for the caller's operator
     * @param newEndpoint The new HTTPS endpoint
     */
    function updateEndpoint(string calldata newEndpoint) external onlyRegistered {
        if (bytes(newEndpoint).length == 0) revert InvalidEndpoint();

        string memory oldEndpoint = operators[msg.sender].endpoint;
        operators[msg.sender].endpoint = newEndpoint;
        operators[msg.sender].lastUpdated = block.timestamp;

        emit EndpointUpdated(msg.sender, oldEndpoint, newEndpoint);
    }

    /**
     * @notice Update supported models for the caller's operator
     * @param models List of model IDs the node supports
     */
    function setSupportedModels(string[] calldata models) external onlyRegistered {
        if (models.length == 0) revert EmptyModels();

        operators[msg.sender].supportedModels = models;
        operators[msg.sender].lastUpdated = block.timestamp;

        emit SupportedModelsUpdated(msg.sender, models);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STAKING
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Stake ZEROP to activate as an operator
     * @param amount Amount of ZEROP to stake (must be >= MIN_STAKE_AMOUNT)
     */
    function stake(uint256 amount) external nonReentrant onlyRegistered {
        if (amount < MIN_STAKE_AMOUNT) revert InsufficientStake();
        if (stakes[msg.sender].amount > 0) revert AlreadyStaked();

        zeropToken.safeTransferFrom(msg.sender, address(this), amount);

        stakes[msg.sender] = StakeInfo({
            amount: amount,
            stakedAt: block.timestamp,
            lastRewardClaim: block.timestamp,
            pendingUnstake: 0,
            unstakeRequestedAt: 0
        });

        // Initialize metrics
        metrics[msg.sender] = PerformanceMetrics({
            totalRequests: 0,
            successfulRequests: 0,
            totalLatencyMs: 0,
            lastActiveAt: block.timestamp,
            uptimeChecksPassed: 0,
            uptimeChecksTotal: 0,
            slashCount: 0
        });

        _addToActiveList(msg.sender);

        emit Staked(msg.sender, amount);
        emit OperatorActivated(msg.sender);
    }

    /**
     * @notice Increase stake for the caller's operator
     * @param additionalAmount Additional ZEROP to stake
     */
    function increaseStake(uint256 additionalAmount) external nonReentrant onlyRegistered {
        if (additionalAmount == 0) revert InvalidAmount();
        if (stakes[msg.sender].amount == 0) revert NotStaked();

        zeropToken.safeTransferFrom(msg.sender, address(this), additionalAmount);
        stakes[msg.sender].amount += additionalAmount;

        emit StakeIncreased(msg.sender, additionalAmount, stakes[msg.sender].amount);
    }

    /**
     * @notice Request to unstake (starts delay period)
     */
    function requestUnstake() external onlyRegistered {
        StakeInfo storage stakeInfo = stakes[msg.sender];
        if (stakeInfo.amount == 0) revert NotStaked();

        stakeInfo.pendingUnstake = stakeInfo.amount;
        stakeInfo.unstakeRequestedAt = block.timestamp;

        _removeFromActiveList(msg.sender);

        emit UnstakeRequested(msg.sender, stakeInfo.amount, block.timestamp + UNSTAKE_DELAY);
        emit OperatorDeactivated(msg.sender);
    }

    /**
     * @notice Complete unstake after delay period
     */
    function unstake() external nonReentrant onlyRegistered {
        StakeInfo storage stakeInfo = stakes[msg.sender];
        if (stakeInfo.pendingUnstake == 0) revert UnstakeNotRequested();
        if (block.timestamp < stakeInfo.unstakeRequestedAt + UNSTAKE_DELAY) {
            revert UnstakeDelayNotPassed();
        }

        uint256 amount = stakeInfo.pendingUnstake;
        delete stakes[msg.sender];

        zeropToken.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // METRICS & PERFORMANCE
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Update performance metrics for an operator (called by rewards contract)
     * @param operator The operator address
     * @param requests Number of new requests
     * @param successful Number of successful requests
     * @param totalLatencyMs Total latency in ms for the requests
     */
    function updateMetrics(
        address operator,
        uint256 requests,
        uint256 successful,
        uint256 totalLatencyMs
    ) external onlyRewards {
        PerformanceMetrics storage m = metrics[operator];
        m.totalRequests += requests;
        m.successfulRequests += successful;
        m.totalLatencyMs += totalLatencyMs;
        m.lastActiveAt = block.timestamp;

        emit MetricsUpdated(
            operator,
            m.totalRequests,
            m.totalRequests > 0 ? (m.successfulRequests * 100) / m.totalRequests : 0,
            m.totalRequests > 0 ? m.totalLatencyMs / m.totalRequests : 0
        );
    }

    /**
     * @notice Record uptime check result (called by rewards contract)
     * @param operator The operator address
     * @param passed Whether the uptime check passed
     */
    function recordUptimeCheck(address operator, bool passed) external onlyRewards {
        PerformanceMetrics storage m = metrics[operator];
        m.uptimeChecksTotal++;
        if (passed) {
            m.uptimeChecksPassed++;
        }
    }

    /**
     * @notice Slash an operator for misbehavior
     * @param operator The operator address
     * @param reason Description of the infraction
     */
    function slashOperator(
        address operator,
        string calldata reason
    ) external onlyOwner {
        StakeInfo storage stakeInfo = stakes[operator];
        if (stakeInfo.amount == 0) revert NotStaked();

        uint256 slashAmount = (stakeInfo.amount * SLASH_PERCENTAGE) / 100;
        stakeInfo.amount -= slashAmount;
        metrics[operator].slashCount++;

        // Send slashed amount to treasury (owner)
        zeropToken.safeTransfer(owner(), slashAmount);

        // If stake falls below minimum, deactivate
        if (stakeInfo.amount < MIN_STAKE_AMOUNT) {
            _removeFromActiveList(operator);
            emit OperatorDeactivated(operator);
        }

        emit OperatorSlashed(operator, slashAmount, reason);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Calculate performance score for an operator (0-100)
     * @param operator The operator address
     */
    function calculatePerformanceScore(address operator) public view returns (uint256) {
        PerformanceMetrics storage m = metrics[operator];

        if (m.totalRequests == 0) return 50; // Default score for new operators

        // Success rate (40% weight) - 0-40 points
        uint256 successRate = (m.successfulRequests * 100) / m.totalRequests;
        uint256 successScore = (successRate * 40) / 100;

        // Latency score (30% weight) - 0-30 points
        uint256 avgLatency = m.totalLatencyMs / m.totalRequests;
        uint256 latencyScore;
        if (avgLatency <= 500) {
            latencyScore = 30;
        } else if (avgLatency >= 5000) {
            latencyScore = 0;
        } else {
            latencyScore = 30 - ((avgLatency - 500) * 30) / 4500;
        }

        // Uptime score (30% weight) - 0-30 points
        uint256 uptimeScore;
        if (m.uptimeChecksTotal == 0) {
            uptimeScore = 15; // Default for new operators
        } else {
            uptimeScore = (m.uptimeChecksPassed * 30) / m.uptimeChecksTotal;
        }

        return successScore + latencyScore + uptimeScore;
    }

    /**
     * @notice Get stake weight multiplier (based on stake amount)
     * @param operator The operator address
     * @return Weight multiplier (100 = 1x, 150 = 1.5x, etc.)
     */
    function getStakeWeight(address operator) public view returns (uint256) {
        uint256 stakeAmount = stakes[operator].amount;
        if (stakeAmount < MIN_STAKE_AMOUNT) return 0;

        uint256 additionalStake = (stakeAmount - MIN_STAKE_AMOUNT) / 1000 ether;
        uint256 weight = 100 + (additionalStake * 10);
        return weight > 200 ? 200 : weight;
    }

    /**
     * @notice Get all active operators
     */
    function getActiveOperators() external view returns (address[] memory) {
        return _activeOperators;
    }

    /**
     * @notice Get count of active operators
     */
    function getActiveOperatorCount() external view returns (uint256) {
        return _activeOperators.length;
    }

    /**
     * @notice Check if an operator is active (staked and not unstaking)
     * @param operator The operator address
     */
    function isOperatorActive(address operator) public view returns (bool) {
        return _activeOperatorIndex[operator] > 0;
    }

    /**
     * @notice Get operator info
     * @param operator The operator address
     */
    function getOperator(address operator) external view returns (
        string memory endpoint,
        string[] memory supportedModels,
        bool isRegistered,
        uint256 registeredAt,
        uint256 lastUpdated
    ) {
        OperatorInfo storage info = operators[operator];
        return (
            info.endpoint,
            info.supportedModels,
            info.isRegistered,
            info.registeredAt,
            info.lastUpdated
        );
    }

    /**
     * @notice Get full operator details including stake and performance
     * @param operator The operator address
     */
    function getOperatorDetails(address operator) external view returns (
        uint256 stakeAmount,
        uint256 performanceScore,
        bool active
    ) {
        return (
            stakes[operator].amount,
            calculatePerformanceScore(operator),
            isOperatorActive(operator)
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Set the rewards contract address
     * @param _rewardsContract Address of the SubnetRewards contract
     */
    function setRewardsContract(address _rewardsContract) external onlyOwner {
        if (_rewardsContract == address(0)) revert InvalidRewardsContract();
        address oldContract = rewardsContract;
        rewardsContract = _rewardsContract;
        emit RewardsContractUpdated(oldContract, _rewardsContract);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function _addToActiveList(address operator) internal {
        if (_activeOperatorIndex[operator] == 0) {
            _activeOperators.push(operator);
            _activeOperatorIndex[operator] = _activeOperators.length; // Store index + 1
        }
    }

    function _removeFromActiveList(address operator) internal {
        uint256 indexPlusOne = _activeOperatorIndex[operator];
        if (indexPlusOne > 0) {
            uint256 index = indexPlusOne - 1;
            uint256 lastIndex = _activeOperators.length - 1;

            if (index != lastIndex) {
                address lastOperator = _activeOperators[lastIndex];
                _activeOperators[index] = lastOperator;
                _activeOperatorIndex[lastOperator] = indexPlusOne;
            }

            _activeOperators.pop();
            delete _activeOperatorIndex[operator];
        }
    }
}
