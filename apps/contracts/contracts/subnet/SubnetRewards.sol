// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./OperatorRegistry.sol";

/**
 * @title SubnetRewards
 * @notice Distributes ZEROP rewards to operators based on requests served
 * @dev Rewards are calculated per epoch (daily) with weighted distribution
 */
contract SubnetRewards is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    uint256 public constant EPOCH_DURATION = 1 days;
    uint256 public constant REWARD_PER_REQUEST = 0.001 ether; // 0.001 ZEROP per request
    uint256 public constant WEIGHT_DECIMALS = 100; // For percentage calculations

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════════

    IERC20 public immutable zeropToken;
    OperatorRegistry public immutable operatorRegistry;

    uint256 public currentEpoch;
    uint256 public epochStartTime;
    uint256 public totalRewardsDistributed;

    // Epoch data
    struct EpochData {
        uint256 totalRequests;
        uint256 totalWeightedRequests;
        uint256 rewardsPool;
        bool finalized;
    }

    // Operator epoch data
    struct OperatorEpochData {
        uint256 requests;
        uint256 successfulRequests;
        uint256 totalLatencyMs;
        uint256 weightedRequests;
        bool claimed;
    }

    mapping(uint256 => EpochData) public epochs;
    mapping(uint256 => mapping(address => OperatorEpochData)) public operatorEpochs; // epoch => operator => data

    // Authorized reporters (backend servers)
    mapping(address => bool) public authorizedReporters;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event RequestsRecorded(
        uint256 indexed epoch,
        address indexed operator,
        uint256 requests,
        uint256 successful,
        uint256 avgLatencyMs
    );
    event EpochFinalized(uint256 indexed epoch, uint256 totalRequests, uint256 rewardsPool);
    event RewardsClaimed(uint256 indexed epoch, address indexed operator, uint256 amount);
    event ReporterUpdated(address indexed reporter, bool authorized);
    event RewardsPoolFunded(uint256 amount, uint256 newBalance);
    event NewEpochStarted(uint256 indexed epoch, uint256 startTime);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════

    error NotAuthorizedReporter();
    error EpochNotFinalized();
    error EpochAlreadyFinalized();
    error AlreadyClaimed();
    error NoRewardsToClaim();
    error InvalidEpoch();
    error EpochNotEnded();
    error OperatorNotActive();

    // ═══════════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════════

    modifier onlyReporter() {
        if (!authorizedReporters[msg.sender]) revert NotAuthorizedReporter();
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    constructor(
        address _zeropToken,
        address _operatorRegistry
    ) Ownable(msg.sender) {
        zeropToken = IERC20(_zeropToken);
        operatorRegistry = OperatorRegistry(_operatorRegistry);

        // Initialize first epoch
        currentEpoch = 1;
        epochStartTime = block.timestamp;

        emit NewEpochStarted(currentEpoch, epochStartTime);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RECORDING REQUESTS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Record requests for an operator (called by authorized backend)
     * @param operator The operator address
     * @param requests Number of requests served
     * @param successful Number of successful requests
     * @param totalLatencyMs Total latency in ms for all requests
     */
    function recordRequests(
        address operator,
        uint256 requests,
        uint256 successful,
        uint256 totalLatencyMs
    ) external onlyReporter {
        // Auto-advance epoch if needed
        _checkAndAdvanceEpoch();

        if (!operatorRegistry.isOperatorActive(operator)) revert OperatorNotActive();

        // Calculate weighted requests based on performance and stake
        uint256 performanceScore = operatorRegistry.calculatePerformanceScore(operator);
        uint256 stakeWeight = operatorRegistry.getStakeWeight(operator);

        // weightedRequests = requests * (performanceScore/100) * (stakeWeight/100)
        uint256 weightedRequests = (requests * performanceScore * stakeWeight) / (WEIGHT_DECIMALS * WEIGHT_DECIMALS);

        // Update operator epoch data
        OperatorEpochData storage opData = operatorEpochs[currentEpoch][operator];
        opData.requests += requests;
        opData.successfulRequests += successful;
        opData.totalLatencyMs += totalLatencyMs;
        opData.weightedRequests += weightedRequests;

        // Update epoch totals
        EpochData storage epoch = epochs[currentEpoch];
        epoch.totalRequests += requests;
        epoch.totalWeightedRequests += weightedRequests;

        // Update operator metrics in registry
        operatorRegistry.updateMetrics(operator, requests, successful, totalLatencyMs);

        emit RequestsRecorded(
            currentEpoch,
            operator,
            requests,
            successful,
            requests > 0 ? totalLatencyMs / requests : 0
        );
    }

    /**
     * @notice Batch record requests for multiple operators
     * @param operatorAddrs Array of operator addresses
     * @param requestCounts Array of request counts
     * @param successCounts Array of successful request counts
     * @param latencies Array of total latencies
     */
    function batchRecordRequests(
        address[] calldata operatorAddrs,
        uint256[] calldata requestCounts,
        uint256[] calldata successCounts,
        uint256[] calldata latencies
    ) external onlyReporter {
        require(
            operatorAddrs.length == requestCounts.length &&
            operatorAddrs.length == successCounts.length &&
            operatorAddrs.length == latencies.length,
            "Array length mismatch"
        );

        _checkAndAdvanceEpoch();

        for (uint256 i = 0; i < operatorAddrs.length; i++) {
            address operator = operatorAddrs[i];

            if (!operatorRegistry.isOperatorActive(operator)) continue;

            uint256 performanceScore = operatorRegistry.calculatePerformanceScore(operator);
            uint256 stakeWeight = operatorRegistry.getStakeWeight(operator);
            uint256 weightedRequests = (requestCounts[i] * performanceScore * stakeWeight) / (WEIGHT_DECIMALS * WEIGHT_DECIMALS);

            OperatorEpochData storage opData = operatorEpochs[currentEpoch][operator];
            opData.requests += requestCounts[i];
            opData.successfulRequests += successCounts[i];
            opData.totalLatencyMs += latencies[i];
            opData.weightedRequests += weightedRequests;

            epochs[currentEpoch].totalRequests += requestCounts[i];
            epochs[currentEpoch].totalWeightedRequests += weightedRequests;

            operatorRegistry.updateMetrics(operator, requestCounts[i], successCounts[i], latencies[i]);

            emit RequestsRecorded(
                currentEpoch,
                operator,
                requestCounts[i],
                successCounts[i],
                requestCounts[i] > 0 ? latencies[i] / requestCounts[i] : 0
            );
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EPOCH MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Finalize the current epoch and start a new one
     */
    function finalizeEpoch() external {
        _checkAndAdvanceEpoch();
    }

    /**
     * @notice Internal function to check and advance epoch
     */
    function _checkAndAdvanceEpoch() internal {
        if (block.timestamp >= epochStartTime + EPOCH_DURATION) {
            // Finalize current epoch
            EpochData storage epoch = epochs[currentEpoch];
            if (!epoch.finalized) {
                // Calculate rewards pool for this epoch
                epoch.rewardsPool = epoch.totalRequests * REWARD_PER_REQUEST;
                epoch.finalized = true;

                emit EpochFinalized(currentEpoch, epoch.totalRequests, epoch.rewardsPool);
            }

            // Start new epoch
            currentEpoch++;
            epochStartTime = block.timestamp;

            emit NewEpochStarted(currentEpoch, epochStartTime);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CLAIMING REWARDS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Claim rewards for a specific epoch
     * @param epoch The epoch to claim rewards for
     */
    function claimRewards(uint256 epoch) external nonReentrant {
        if (epoch >= currentEpoch) revert InvalidEpoch();
        if (!epochs[epoch].finalized) revert EpochNotFinalized();

        OperatorEpochData storage opData = operatorEpochs[epoch][msg.sender];
        if (opData.claimed) revert AlreadyClaimed();
        if (opData.weightedRequests == 0) revert NoRewardsToClaim();

        // Calculate operator's share of the rewards pool
        EpochData storage epochData = epochs[epoch];
        uint256 reward = (epochData.rewardsPool * opData.weightedRequests) / epochData.totalWeightedRequests;

        opData.claimed = true;
        totalRewardsDistributed += reward;

        // Transfer rewards to operator
        zeropToken.safeTransfer(msg.sender, reward);

        emit RewardsClaimed(epoch, msg.sender, reward);
    }

    /**
     * @notice Claim rewards for multiple epochs
     * @param epochList Array of epochs to claim
     */
    function claimMultipleEpochs(uint256[] calldata epochList) external nonReentrant {
        uint256 totalReward = 0;

        for (uint256 i = 0; i < epochList.length; i++) {
            uint256 epoch = epochList[i];

            if (epoch >= currentEpoch) continue;
            if (!epochs[epoch].finalized) continue;

            OperatorEpochData storage opData = operatorEpochs[epoch][msg.sender];
            if (opData.claimed || opData.weightedRequests == 0) continue;

            EpochData storage epochData = epochs[epoch];
            uint256 reward = (epochData.rewardsPool * opData.weightedRequests) / epochData.totalWeightedRequests;

            opData.claimed = true;
            totalReward += reward;

            emit RewardsClaimed(epoch, msg.sender, reward);
        }

        if (totalReward > 0) {
            totalRewardsDistributed += totalReward;
            zeropToken.safeTransfer(msg.sender, totalReward);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get pending rewards for an operator across all claimable epochs
     * @param operator The operator address
     */
    function getPendingRewards(address operator) external view returns (uint256 totalPending) {
        for (uint256 epoch = 1; epoch < currentEpoch; epoch++) {
            if (!epochs[epoch].finalized) continue;

            OperatorEpochData storage opData = operatorEpochs[epoch][operator];
            if (opData.claimed || opData.weightedRequests == 0) continue;

            EpochData storage epochData = epochs[epoch];
            uint256 reward = (epochData.rewardsPool * opData.weightedRequests) / epochData.totalWeightedRequests;
            totalPending += reward;
        }
    }

    /**
     * @notice Get operator stats for current epoch
     * @param operator The operator address
     */
    function getCurrentEpochStats(address operator) external view returns (
        uint256 requests,
        uint256 successful,
        uint256 avgLatencyMs,
        uint256 weightedRequests,
        uint256 estimatedReward
    ) {
        OperatorEpochData storage opData = operatorEpochs[currentEpoch][operator];
        EpochData storage epochData = epochs[currentEpoch];

        uint256 avgLatency = opData.requests > 0 ? opData.totalLatencyMs / opData.requests : 0;
        uint256 estimated = 0;

        if (epochData.totalWeightedRequests > 0) {
            uint256 potentialPool = epochData.totalRequests * REWARD_PER_REQUEST;
            estimated = (potentialPool * opData.weightedRequests) / epochData.totalWeightedRequests;
        }

        return (
            opData.requests,
            opData.successfulRequests,
            avgLatency,
            opData.weightedRequests,
            estimated
        );
    }

    /**
     * @notice Get global epoch stats (no operator param — for explorer overview)
     */
    function getGlobalEpochStats() external view returns (
        uint256 epoch,
        uint256 totalRewards,
        uint256 totalStaked
    ) {
        EpochData storage epochData = epochs[currentEpoch];
        return (
            currentEpoch,
            epochData.totalRequests * REWARD_PER_REQUEST,
            0 // totalStaked not tracked here, query OperatorRegistry
        );
    }

    /**
     * @notice Get epoch info
     * @param epoch The epoch number
     */
    function getEpochInfo(uint256 epoch) external view returns (
        uint256 totalRequests,
        uint256 totalWeightedRequests,
        uint256 rewardsPool,
        bool finalized
    ) {
        EpochData storage e = epochs[epoch];
        return (e.totalRequests, e.totalWeightedRequests, e.rewardsPool, e.finalized);
    }

    /**
     * @notice Get time until next epoch
     */
    function timeUntilNextEpoch() external view returns (uint256) {
        uint256 nextEpochStart = epochStartTime + EPOCH_DURATION;
        if (block.timestamp >= nextEpochStart) return 0;
        return nextEpochStart - block.timestamp;
    }

    /**
     * @notice Get rewards pool balance
     */
    function getRewardsPoolBalance() external view returns (uint256) {
        return zeropToken.balanceOf(address(this));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Set authorized reporter status
     * @param reporter Address to authorize/deauthorize
     * @param authorized Whether the address is authorized
     */
    function setAuthorizedReporter(address reporter, bool authorized) external onlyOwner {
        authorizedReporters[reporter] = authorized;
        emit ReporterUpdated(reporter, authorized);
    }

    /**
     * @notice Fund the rewards pool
     * @param amount Amount of ZEROP to add
     */
    function fundRewardsPool(uint256 amount) external {
        zeropToken.safeTransferFrom(msg.sender, address(this), amount);
        emit RewardsPoolFunded(amount, zeropToken.balanceOf(address(this)));
    }

    /**
     * @notice Emergency withdraw (only owner, for recovery)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        zeropToken.safeTransfer(owner(), amount);
    }
}
