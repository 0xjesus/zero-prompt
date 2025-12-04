// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title ZeroPromptVault
 * @notice Hybrid billing vault for ZeroPrompt
 * @dev Users deposit AVAX, usage is tracked off-chain, users withdraw with operator signature
 *
 * Key Design:
 * - deposit(): User pays gas, funds go to contract
 * - withdrawWithPermit(): User pays gas, operator signs authorization
 * - withdrawProfits(): Owner extracts earned revenue (pays own gas)
 *
 * GAS COSTS FOR ZEROPROMPT: $0 for normal operations
 */
contract ZeroPromptVault is ReentrancyGuard, Ownable, Pausable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ═══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    event Deposited(
        address indexed user,
        uint256 amount,
        uint256 indexed depositId,
        uint256 timestamp
    );

    event Withdrawn(
        address indexed user,
        uint256 amount,
        uint256 indexed nonce,
        uint256 timestamp
    );

    event ProfitsWithdrawn(
        address indexed owner,
        uint256 amount,
        uint256 timestamp
    );

    event OperatorUpdated(
        address indexed oldOperator,
        address indexed newOperator
    );

    // ═══════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════

    struct Deposit {
        address user;
        uint256 amount;
        uint256 timestamp;
    }

    // Operator address that signs withdrawal permits
    address public operator;

    // Deposit tracking
    uint256 public depositCount;
    mapping(uint256 => Deposit) public deposits;
    mapping(address => uint256) public totalDeposited;

    // Nonces for replay protection on withdrawals
    mapping(address => uint256) public nonces;

    // Minimum deposit amount (0.001 AVAX = 1e15 wei)
    uint256 public minDeposit = 1e15;

    // Permit validity window (default 1 hour)
    uint256 public permitValidityWindow = 3600;

    // ═══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════

    constructor(address _operator) Ownable(msg.sender) {
        require(_operator != address(0), "Invalid operator");
        operator = _operator;
        emit OperatorUpdated(address(0), _operator);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // USER FUNCTIONS (User pays gas)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Deposit AVAX to get credits
     * @dev Backend listens to Deposited event and credits user's off-chain balance
     */
    function deposit() external payable nonReentrant whenNotPaused {
        require(msg.value >= minDeposit, "Below minimum deposit");

        depositCount++;
        deposits[depositCount] = Deposit({
            user: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp
        });

        totalDeposited[msg.sender] += msg.value;

        emit Deposited(msg.sender, msg.value, depositCount, block.timestamp);
    }

    /**
     * @notice Withdraw remaining credits with operator signature
     * @param amount Amount in wei to withdraw
     * @param deadline Timestamp after which permit expires
     * @param signature Operator's signature authorizing this withdrawal
     *
     * @dev Flow:
     * 1. User requests withdrawal from backend API
     * 2. Backend checks off-chain balance
     * 3. Backend signs permit: (user, amount, nonce, deadline)
     * 4. User calls this function with signature
     * 5. Contract verifies signature and sends AVAX
     * 6. USER PAYS GAS - ZeroPrompt pays nothing!
     */
    function withdrawWithPermit(
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        require(block.timestamp <= deadline, "Permit expired");
        require(amount > 0, "Amount must be > 0");
        require(address(this).balance >= amount, "Insufficient contract balance");

        // Get current nonce and increment
        uint256 currentNonce = nonces[msg.sender];
        nonces[msg.sender] = currentNonce + 1;

        // Reconstruct the message hash that operator should have signed
        bytes32 messageHash = keccak256(abi.encodePacked(
            address(this),      // Contract address (prevents cross-contract replay)
            msg.sender,         // Only this user can use this signature
            amount,             // Exact amount authorized
            currentNonce,       // Prevents replay
            deadline,           // Time-limited validity
            block.chainid       // Chain-specific (prevents cross-chain replay)
        ));

        // Convert to Ethereum signed message hash
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();

        // Recover signer from signature
        address signer = ethSignedHash.recover(signature);
        require(signer == operator, "Invalid operator signature");

        // Transfer AVAX to user
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");

        emit Withdrawn(msg.sender, amount, currentNonce, block.timestamp);
    }

    /**
     * @notice Get the message hash for a withdrawal permit (for frontend/backend use)
     */
    function getWithdrawalHash(
        address user,
        uint256 amount,
        uint256 deadline
    ) external view returns (bytes32) {
        return keccak256(abi.encodePacked(
            address(this),
            user,
            amount,
            nonces[user],
            deadline,
            block.chainid
        ));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // OWNER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Withdraw profits (revenue from used credits)
     * @param amount Amount to withdraw
     * @dev Only owner can call, owner pays gas (acceptable for profit extraction)
     */
    function withdrawProfits(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(address(this).balance >= amount, "Insufficient balance");

        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Transfer failed");

        emit ProfitsWithdrawn(owner(), amount, block.timestamp);
    }

    /**
     * @notice Update the operator address
     */
    function setOperator(address _operator) external onlyOwner {
        require(_operator != address(0), "Invalid operator");
        address oldOperator = operator;
        operator = _operator;
        emit OperatorUpdated(oldOperator, _operator);
    }

    /**
     * @notice Update minimum deposit amount
     */
    function setMinDeposit(uint256 _minDeposit) external onlyOwner {
        minDeposit = _minDeposit;
    }

    /**
     * @notice Update permit validity window
     */
    function setPermitValidityWindow(uint256 _window) external onlyOwner {
        permitValidityWindow = _window;
    }

    /**
     * @notice Pause the contract in case of emergency
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Get deposit details
     */
    function getDeposit(uint256 depositId) external view returns (
        address user,
        uint256 amount,
        uint256 timestamp
    ) {
        Deposit memory d = deposits[depositId];
        return (d.user, d.amount, d.timestamp);
    }

    /**
     * @notice Get contract's total AVAX balance
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Get user's current nonce (for building withdrawal permits)
     */
    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RECEIVE FUNCTION
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Accept direct AVAX transfers as deposits
     */
    receive() external payable {
        require(msg.value >= minDeposit, "Below minimum deposit");

        depositCount++;
        deposits[depositCount] = Deposit({
            user: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp
        });

        totalDeposited[msg.sender] += msg.value;

        emit Deposited(msg.sender, msg.value, depositCount, block.timestamp);
    }
}
