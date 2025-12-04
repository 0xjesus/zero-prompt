# ZeroPrompt Hybrid Billing System - Plan

## Problema Actual

```
Usuario usa API → Backend llama recordUsage() on-chain → Backend paga gas
                                                          ↑
                                                    NOSOTROS PAGAMOS TODO
```

Cada mensaje = 1 transacción on-chain = ~0.001-0.005 AVAX de gas que NOSOTROS pagamos.

---

## Solución Propuesta: Hybrid Billing

```
┌─────────────────────────────────────────────────────────────────────┐
│                        HYBRID BILLING SYSTEM                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ON-CHAIN (Usuario paga gas)          OFF-CHAIN (Gratis)          │
│   ┌─────────────────────────┐          ┌─────────────────────┐     │
│   │                         │          │                     │     │
│   │  1. deposit()           │          │  1. Track usage     │     │
│   │     User → Contract     │  ──────► │     in PostgreSQL   │     │
│   │     (User pays gas)     │          │                     │     │
│   │                         │          │  2. Deduct credits  │     │
│   │  2. withdraw()          │  ◄────── │     instantly       │     │
│   │     Contract → User     │          │                     │     │
│   │     (User pays gas)     │          │  3. Check balance   │     │
│   │                         │          │     before API call │     │
│   └─────────────────────────┘          └─────────────────────┘     │
│                                                                     │
│   NOSOTROS NO PAGAMOS NADA                                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Arquitectura Detallada

### 1. Nuevo Smart Contract: `ZeroPromptVault.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title ZeroPromptVault
 * @notice Simple vault for deposits/withdrawals. Usage tracking is OFF-CHAIN.
 * @dev Users deposit AVAX, backend tracks usage in DB, users withdraw remaining balance
 */
contract ZeroPromptVault is ReentrancyGuard, Ownable, Pausable {

    // ═══════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════

    event Deposited(
        address indexed user,
        uint256 amount,
        uint256 depositId,
        uint256 timestamp
    );

    event WithdrawalRequested(
        address indexed user,
        uint256 amount,
        uint256 requestId,
        uint256 timestamp
    );

    event WithdrawalProcessed(
        address indexed user,
        uint256 amount,
        uint256 requestId,
        uint256 timestamp
    );

    event WithdrawalCancelled(
        address indexed user,
        uint256 requestId,
        string reason
    );

    event EmergencyWithdraw(
        address indexed user,
        uint256 amount
    );

    // ═══════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════

    struct Deposit {
        address user;
        uint256 amount;
        uint256 timestamp;
        bool processed; // Confirmed by backend
    }

    struct WithdrawalRequest {
        address user;
        uint256 amount;
        uint256 requestedAt;
        uint256 processedAt;
        bool pending;
        bool approved;
    }

    mapping(address => uint256) public totalDeposited;
    mapping(uint256 => Deposit) public deposits;
    mapping(uint256 => WithdrawalRequest) public withdrawalRequests;

    uint256 public depositCount;
    uint256 public withdrawalRequestCount;
    uint256 public minDeposit = 0.01 ether; // Min 0.01 AVAX
    uint256 public withdrawalDelay = 0; // Can add delay for security

    // Backend operator address (can approve withdrawals)
    address public operator;

    // ═══════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════

    modifier onlyOperator() {
        require(msg.sender == operator || msg.sender == owner(), "Not operator");
        _;
    }

    // ═══════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════

    constructor(address _operator) Ownable(msg.sender) {
        operator = _operator;
    }

    // ═══════════════════════════════════════════════════════════════════
    // USER FUNCTIONS (User pays gas)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Deposit AVAX to get credits
     * @dev Backend will listen to Deposited event and credit user's DB balance
     */
    function deposit() external payable nonReentrant whenNotPaused {
        require(msg.value >= minDeposit, "Below minimum deposit");

        depositCount++;
        deposits[depositCount] = Deposit({
            user: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp,
            processed: false
        });

        totalDeposited[msg.sender] += msg.value;

        emit Deposited(msg.sender, msg.value, depositCount, block.timestamp);
    }

    /**
     * @notice Request withdrawal of remaining credits
     * @param amount Amount in wei to withdraw
     * @dev Backend will verify DB balance and approve/reject
     */
    function requestWithdrawal(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");

        withdrawalRequestCount++;
        withdrawalRequests[withdrawalRequestCount] = WithdrawalRequest({
            user: msg.sender,
            amount: amount,
            requestedAt: block.timestamp,
            processedAt: 0,
            pending: true,
            approved: false
        });

        emit WithdrawalRequested(
            msg.sender,
            amount,
            withdrawalRequestCount,
            block.timestamp
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    // OPERATOR FUNCTIONS (Backend calls these - WE PAY GAS HERE)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Mark deposit as processed (confirmed in DB)
     * @dev Called by backend after crediting user's DB balance
     */
    function confirmDeposit(uint256 depositId) external onlyOperator {
        require(deposits[depositId].user != address(0), "Deposit not found");
        require(!deposits[depositId].processed, "Already processed");

        deposits[depositId].processed = true;
    }

    /**
     * @notice Approve and process withdrawal
     * @dev Backend verifies user has enough DB balance, then calls this
     */
    function approveWithdrawal(uint256 requestId) external onlyOperator nonReentrant {
        WithdrawalRequest storage request = withdrawalRequests[requestId];

        require(request.user != address(0), "Request not found");
        require(request.pending, "Not pending");
        require(address(this).balance >= request.amount, "Insufficient contract balance");

        request.pending = false;
        request.approved = true;
        request.processedAt = block.timestamp;

        // Transfer funds to user
        (bool success, ) = request.user.call{value: request.amount}("");
        require(success, "Transfer failed");

        emit WithdrawalProcessed(
            request.user,
            request.amount,
            requestId,
            block.timestamp
        );
    }

    /**
     * @notice Reject withdrawal request
     */
    function rejectWithdrawal(uint256 requestId, string calldata reason) external onlyOperator {
        WithdrawalRequest storage request = withdrawalRequests[requestId];

        require(request.user != address(0), "Request not found");
        require(request.pending, "Not pending");

        request.pending = false;
        request.approved = false;
        request.processedAt = block.timestamp;

        emit WithdrawalCancelled(request.user, requestId, reason);
    }

    // ═══════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════

    function setOperator(address _operator) external onlyOwner {
        operator = _operator;
    }

    function setMinDeposit(uint256 _minDeposit) external onlyOwner {
        minDeposit = _minDeposit;
    }

    function setWithdrawalDelay(uint256 _delay) external onlyOwner {
        withdrawalDelay = _delay;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency withdraw for owner (e.g., contract migration)
     */
    function emergencyWithdrawAll() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Transfer failed");
        emit EmergencyWithdraw(owner(), balance);
    }

    // ═══════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════

    function getDeposit(uint256 depositId) external view returns (Deposit memory) {
        return deposits[depositId];
    }

    function getWithdrawalRequest(uint256 requestId) external view returns (WithdrawalRequest memory) {
        return withdrawalRequests[requestId];
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {
        // Allow receiving AVAX directly (counts as deposit)
        depositCount++;
        deposits[depositCount] = Deposit({
            user: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp,
            processed: false
        });
        totalDeposited[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value, depositCount, block.timestamp);
    }
}
```

---

### 2. Database Schema Changes

```prisma
// Agregar a schema.prisma

model UserBalance {
  id            Int      @id @default(autoincrement())

  // User identification
  walletAddress String   @unique @map("wallet_address")

  // Balances (stored in USD with 18 decimals precision)
  totalDeposited  Decimal  @default(0) @db.Decimal(36, 18)
  totalUsed       Decimal  @default(0) @db.Decimal(36, 18)
  currentBalance  Decimal  @default(0) @db.Decimal(36, 18) // = deposited - used

  // Free credits (promotional)
  freeCredits     Decimal  @default(0) @db.Decimal(36, 18)
  freeCreditsUsed Decimal  @default(0) @db.Decimal(36, 18)

  // Timestamps
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  // Relations
  deposits      DepositRecord[]
  usageRecords  UsageRecord[]
  withdrawals   WithdrawalRecord[]

  @@map("user_balances")
}

model DepositRecord {
  id              Int      @id @default(autoincrement())

  // Link to user
  userBalanceId   Int      @map("user_balance_id")
  userBalance     UserBalance @relation(fields: [userBalanceId], references: [id])

  // On-chain reference
  depositId       Int      @map("deposit_id") // From smart contract event
  txHash          String   @map("tx_hash")
  blockNumber     Int      @map("block_number")

  // Amount
  amountAVAX      Decimal  @db.Decimal(36, 18) @map("amount_avax")
  amountUSD       Decimal  @db.Decimal(36, 18) @map("amount_usd")
  avaxPriceUSD    Decimal  @db.Decimal(18, 8) @map("avax_price_usd")

  // Status
  status          String   @default("confirmed") // confirmed, failed
  processedAt     DateTime @default(now()) @map("processed_at")

  createdAt       DateTime @default(now()) @map("created_at")

  @@unique([depositId])
  @@map("deposit_records")
}

model UsageRecord {
  id              Int      @id @default(autoincrement())

  // Link to user
  userBalanceId   Int      @map("user_balance_id")
  userBalance     UserBalance @relation(fields: [userBalanceId], references: [id])

  // Request info
  requestId       String   @unique @map("request_id")
  model           String
  inputTokens     Int      @map("input_tokens")
  outputTokens    Int      @map("output_tokens")

  // Cost
  costUSD         Decimal  @db.Decimal(36, 18) @map("cost_usd")

  // Timestamps
  createdAt       DateTime @default(now()) @map("created_at")

  @@index([userBalanceId, createdAt])
  @@map("usage_records")
}

model WithdrawalRecord {
  id              Int      @id @default(autoincrement())

  // Link to user
  userBalanceId   Int      @map("user_balance_id")
  userBalance     UserBalance @relation(fields: [userBalanceId], references: [id])

  // On-chain reference
  requestId       Int      @map("request_id") // From smart contract
  txHash          String?  @map("tx_hash") // Set when processed

  // Amount
  amountAVAX      Decimal  @db.Decimal(36, 18) @map("amount_avax")
  amountUSD       Decimal  @db.Decimal(36, 18) @map("amount_usd")

  // Status
  status          String   @default("pending") // pending, approved, rejected, processed
  rejectionReason String?  @map("rejection_reason")

  requestedAt     DateTime @default(now()) @map("requested_at")
  processedAt     DateTime? @map("processed_at")

  @@map("withdrawal_records")
}
```

---

### 3. Backend Services

#### 3.1 Deposit Event Listener

```typescript
// services/depositListener.ts

import { ethers } from 'ethers';
import { prisma } from '../db';

const VAULT_ABI = [
  "event Deposited(address indexed user, uint256 amount, uint256 depositId, uint256 timestamp)"
];

export class DepositListener {
  private provider: ethers.WebSocketProvider;
  private contract: ethers.Contract;

  constructor(rpcUrl: string, contractAddress: string) {
    this.provider = new ethers.WebSocketProvider(rpcUrl);
    this.contract = new ethers.Contract(contractAddress, VAULT_ABI, this.provider);
  }

  start() {
    console.log('[DepositListener] Starting...');

    this.contract.on('Deposited', async (user, amount, depositId, timestamp, event) => {
      try {
        console.log(`[Deposit] New deposit: ${user} - ${ethers.formatEther(amount)} AVAX`);

        // Get current AVAX price
        const avaxPrice = await this.getAVAXPrice();
        const amountAVAX = parseFloat(ethers.formatEther(amount));
        const amountUSD = amountAVAX * avaxPrice;

        // Upsert user balance
        const userBalance = await prisma.userBalance.upsert({
          where: { walletAddress: user.toLowerCase() },
          create: {
            walletAddress: user.toLowerCase(),
            totalDeposited: amountUSD,
            currentBalance: amountUSD,
          },
          update: {
            totalDeposited: { increment: amountUSD },
            currentBalance: { increment: amountUSD },
          }
        });

        // Record deposit
        await prisma.depositRecord.create({
          data: {
            userBalanceId: userBalance.id,
            depositId: Number(depositId),
            txHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber,
            amountAVAX: amountAVAX,
            amountUSD: amountUSD,
            avaxPriceUSD: avaxPrice,
            status: 'confirmed'
          }
        });

        console.log(`[Deposit] Credited $${amountUSD.toFixed(4)} to ${user}`);

      } catch (error) {
        console.error('[Deposit] Error processing deposit:', error);
      }
    });
  }

  private async getAVAXPrice(): Promise<number> {
    // Use Chainlink or CoinGecko
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=avalanche-2&vs_currencies=usd'
    );
    const data = await response.json();
    return data['avalanche-2'].usd;
  }
}
```

#### 3.2 Usage Tracking Service

```typescript
// services/usageTracker.ts

import { prisma } from '../db';
import { Decimal } from '@prisma/client/runtime/library';

export class UsageTracker {

  /**
   * Check if user has enough balance for estimated cost
   */
  async checkBalance(walletAddress: string, estimatedCostUSD: number): Promise<{
    hasBalance: boolean;
    currentBalance: number;
    shortfall: number;
  }> {
    const balance = await prisma.userBalance.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() }
    });

    if (!balance) {
      return { hasBalance: false, currentBalance: 0, shortfall: estimatedCostUSD };
    }

    const current = Number(balance.currentBalance) + Number(balance.freeCredits) - Number(balance.freeCreditsUsed);
    const hasBalance = current >= estimatedCostUSD;

    return {
      hasBalance,
      currentBalance: current,
      shortfall: hasBalance ? 0 : estimatedCostUSD - current
    };
  }

  /**
   * Record usage and deduct from balance
   * Returns false if insufficient balance
   */
  async recordUsage(
    walletAddress: string,
    requestId: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    costUSD: number
  ): Promise<{ success: boolean; newBalance: number; error?: string }> {

    const address = walletAddress.toLowerCase();

    return await prisma.$transaction(async (tx) => {
      // Get current balance with lock
      const balance = await tx.userBalance.findUnique({
        where: { walletAddress: address }
      });

      if (!balance) {
        return { success: false, newBalance: 0, error: 'no_account' };
      }

      // Calculate available balance (paid + free credits)
      const freeAvailable = Number(balance.freeCredits) - Number(balance.freeCreditsUsed);
      const paidBalance = Number(balance.currentBalance);
      const totalAvailable = paidBalance + freeAvailable;

      if (totalAvailable < costUSD) {
        return {
          success: false,
          newBalance: totalAvailable,
          error: 'insufficient_balance'
        };
      }

      // Deduct from free credits first, then paid balance
      let freeDeduction = Math.min(freeAvailable, costUSD);
      let paidDeduction = costUSD - freeDeduction;

      // Update balance
      const updated = await tx.userBalance.update({
        where: { walletAddress: address },
        data: {
          totalUsed: { increment: costUSD },
          currentBalance: { decrement: paidDeduction },
          freeCreditsUsed: { increment: freeDeduction }
        }
      });

      // Record usage
      await tx.usageRecord.create({
        data: {
          userBalanceId: balance.id,
          requestId,
          model,
          inputTokens,
          outputTokens,
          costUSD
        }
      });

      const newBalance = Number(updated.currentBalance) +
                         Number(updated.freeCredits) -
                         Number(updated.freeCreditsUsed);

      return { success: true, newBalance };
    });
  }

  /**
   * Get user's usage history
   */
  async getUsageHistory(walletAddress: string, limit = 50) {
    const balance = await prisma.userBalance.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
      include: {
        usageRecords: {
          orderBy: { createdAt: 'desc' },
          take: limit
        },
        deposits: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });

    return balance;
  }
}

export const usageTracker = new UsageTracker();
```

#### 3.3 Withdrawal Service

```typescript
// services/withdrawalService.ts

import { ethers } from 'ethers';
import { prisma } from '../db';

export class WithdrawalService {
  private contract: ethers.Contract;
  private wallet: ethers.Wallet;

  constructor(rpcUrl: string, contractAddress: string, operatorPrivateKey: string) {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(operatorPrivateKey, provider);
    this.contract = new ethers.Contract(contractAddress, VAULT_ABI, this.wallet);
  }

  /**
   * Process pending withdrawal requests
   * Called periodically or on-demand
   */
  async processPendingWithdrawals() {
    const pending = await prisma.withdrawalRecord.findMany({
      where: { status: 'pending' },
      include: { userBalance: true }
    });

    for (const withdrawal of pending) {
      try {
        // Verify user's DB balance
        const balance = withdrawal.userBalance;
        const availableUSD = Number(balance.currentBalance);
        const requestedUSD = Number(withdrawal.amountUSD);

        if (availableUSD < requestedUSD) {
          // Reject - insufficient balance
          await this.rejectWithdrawal(
            withdrawal.requestId,
            `Insufficient balance. Available: $${availableUSD.toFixed(4)}, Requested: $${requestedUSD.toFixed(4)}`
          );
          continue;
        }

        // Approve on-chain (WE PAY GAS HERE - but only for withdrawals!)
        const tx = await this.contract.approveWithdrawal(withdrawal.requestId);
        const receipt = await tx.wait();

        // Update DB
        await prisma.$transaction([
          prisma.withdrawalRecord.update({
            where: { id: withdrawal.id },
            data: {
              status: 'processed',
              txHash: receipt.hash,
              processedAt: new Date()
            }
          }),
          prisma.userBalance.update({
            where: { id: withdrawal.userBalanceId },
            data: {
              currentBalance: { decrement: requestedUSD }
            }
          })
        ]);

        console.log(`[Withdrawal] Processed: ${receipt.hash}`);

      } catch (error) {
        console.error(`[Withdrawal] Error processing ${withdrawal.id}:`, error);
      }
    }
  }

  private async rejectWithdrawal(requestId: number, reason: string) {
    const tx = await this.contract.rejectWithdrawal(requestId, reason);
    await tx.wait();

    await prisma.withdrawalRecord.update({
      where: { requestId },
      data: {
        status: 'rejected',
        rejectionReason: reason,
        processedAt: new Date()
      }
    });
  }
}
```

---

### 4. Flow Diagrams

#### 4.1 Deposit Flow

```
┌─────────┐          ┌──────────────┐          ┌──────────────┐
│  User   │          │Smart Contract│          │   Backend    │
└────┬────┘          └──────┬───────┘          └──────┬───────┘
     │                      │                         │
     │  1. deposit()        │                         │
     │  (sends AVAX)        │                         │
     │─────────────────────►│                         │
     │                      │                         │
     │  User pays gas ✓     │  2. Emit Deposited     │
     │                      │     event               │
     │                      │────────────────────────►│
     │                      │                         │
     │                      │                         │ 3. Listen to event
     │                      │                         │    Get AVAX price
     │                      │                         │    Credit DB balance
     │                      │                         │
     │  4. Balance updated  │                         │
     │◄──────────────────────────────────────────────│
     │     (via API/WS)     │                         │
```

#### 4.2 Usage Flow

```
┌─────────┐          ┌──────────────┐          ┌──────────────┐
│  User   │          │   Backend    │          │  PostgreSQL  │
└────┬────┘          └──────┬───────┘          └──────┬───────┘
     │                      │                         │
     │  1. API Request      │                         │
     │─────────────────────►│                         │
     │                      │                         │
     │                      │  2. Check balance       │
     │                      │────────────────────────►│
     │                      │◄────────────────────────│
     │                      │                         │
     │                      │  (if sufficient)        │
     │                      │                         │
     │                      │  3. Process request     │
     │                      │     (call OpenRouter)   │
     │                      │                         │
     │                      │  4. Deduct from DB      │
     │                      │────────────────────────►│
     │                      │                         │
     │  5. Response +       │                         │
     │     new balance      │                         │
     │◄─────────────────────│                         │
     │                      │                         │
     │  NO ON-CHAIN TX!     │                         │
     │  INSTANT! FREE!      │                         │
```

#### 4.3 Withdrawal Flow

```
┌─────────┐          ┌──────────────┐          ┌──────────────┐
│  User   │          │Smart Contract│          │   Backend    │
└────┬────┘          └──────┬───────┘          └──────┬───────┘
     │                      │                         │
     │  1. requestWithdraw()│                         │
     │  (User pays gas)     │                         │
     │─────────────────────►│                         │
     │                      │                         │
     │                      │  2. Emit               │
     │                      │  WithdrawalRequested   │
     │                      │────────────────────────►│
     │                      │                         │
     │                      │                         │ 3. Verify DB balance
     │                      │                         │
     │                      │  4. approveWithdrawal() │
     │                      │◄────────────────────────│
     │                      │  (Backend pays gas)     │
     │                      │                         │
     │  5. Receive AVAX     │                         │
     │◄─────────────────────│                         │
```

---

### 5. Cost Analysis

#### Current System (On-Chain Usage Recording)
| Action | Who Pays | Gas Cost | Frequency |
|--------|----------|----------|-----------|
| Deposit | User | ~0.002 AVAX | Per deposit |
| Record Usage | **Backend** | ~0.003 AVAX | **Every message** |
| Withdraw | Backend | ~0.003 AVAX | Per withdrawal |

**If 1000 messages/day:**
- Backend gas cost: ~3 AVAX/day = **~$90/day** = **$2,700/month** 💸

#### New Hybrid System
| Action | Who Pays | Gas Cost | Frequency |
|--------|----------|----------|-----------|
| Deposit | User | ~0.002 AVAX | Per deposit |
| Record Usage | **Nobody** | $0 | N/A (DB only) |
| Approve Withdrawal | Backend | ~0.003 AVAX | Per withdrawal |

**If 1000 messages/day, 10 withdrawals/day:**
- Backend gas cost: ~0.03 AVAX/day = **~$0.90/day** = **$27/month** 💰

**Savings: 99%+ reduction in gas costs**

---

### 6. Security Considerations

#### 6.1 Deposit Security
- ✅ Funds are held in audited smart contract
- ✅ Users can verify contract balance on-chain
- ✅ Events provide proof of deposits

#### 6.2 Usage Tracking Security
- ⚠️ Users must trust our DB for usage tracking
- ✅ Mitigation: Detailed usage logs with request IDs
- ✅ Mitigation: Usage history API for transparency
- ✅ Mitigation: Option for periodic on-chain settlement (optional feature)

#### 6.3 Withdrawal Security
- ✅ Backend verifies DB balance before approving
- ✅ On-chain withdrawal request prevents us from ignoring
- ✅ Emergency withdraw function for edge cases
- ⚠️ Consider adding time-lock for large withdrawals

#### 6.4 What if Backend is Compromised?
- Contract has `pause()` function
- Owner can perform emergency withdrawal
- Consider multi-sig for owner role

---

### 7. Migration Plan

#### Phase 1: Deploy New Contract
1. Deploy `ZeroPromptVault.sol` to Avalanche mainnet
2. Set operator address
3. Test with small amounts

#### Phase 2: Backend Changes
1. Add new Prisma models
2. Run migration
3. Implement `DepositListener`
4. Implement `UsageTracker`
5. Update `/llm/stream` to use `usageTracker.recordUsage()`
6. Implement `WithdrawalService`

#### Phase 3: Frontend Changes
1. Update deposit UI to use new contract
2. Add withdrawal request UI
3. Show off-chain balance from new API
4. Add usage history view

#### Phase 4: Migration of Existing Users
1. Read balances from old contract
2. Credit equivalent in new DB
3. Optional: Allow users to withdraw from old contract

#### Phase 5: Deprecate Old Contract
1. Pause old contract
2. Remove old billing service code
3. Update documentation

---

### 8. API Endpoints

```typescript
// New endpoints needed

// Get user balance
GET /billing/balance
Response: {
  totalDeposited: "125.50",
  totalUsed: "43.21",
  currentBalance: "82.29",
  freeCredits: "1.00",
  freeCreditsRemaining: "0.50"
}

// Get deposit history
GET /billing/deposits
Response: {
  deposits: [
    { id: 1, amount: "50.00", txHash: "0x...", date: "..." },
    ...
  ]
}

// Get usage history
GET /billing/usage?limit=50
Response: {
  usage: [
    { model: "gpt-4", cost: "0.0234", tokens: 1500, date: "..." },
    ...
  ]
}

// Get withdrawal history
GET /billing/withdrawals
Response: {
  withdrawals: [
    { id: 1, amount: "10.00", status: "processed", txHash: "0x..." },
    ...
  ]
}

// Request withdrawal (triggers on-chain request from frontend)
POST /billing/withdraw/prepare
Body: { amount: "10.00" }
Response: {
  amountAVAX: "0.285",
  contractAddress: "0x...",
  userBalance: "82.29"
}
```

---

### 9. Files to Create/Modify

#### New Files
```
apps/api/
├── src/
│   ├── services/
│   │   ├── depositListener.ts      # Listen to deposit events
│   │   ├── usageTracker.ts         # Track usage in DB
│   │   └── withdrawalService.ts    # Process withdrawals
│   └── routes/
│       └── billingV2.ts            # New billing endpoints

contracts/
└── ZeroPromptVault.sol             # New simplified contract

prisma/
└── schema.prisma                   # Add new models
```

#### Modified Files
```
apps/api/src/routes/llm.ts          # Use usageTracker instead of on-chain
apps/api/src/index.ts               # Start deposit listener
apps/zeroprompt/                    # Frontend changes for new contract
```

---

### 10. Timeline Estimate

| Phase | Tasks | Effort |
|-------|-------|--------|
| 1. Contract | Write, test, deploy | 1 day |
| 2. Backend | Services + routes | 2 days |
| 3. Frontend | UI updates | 1 day |
| 4. Migration | User balances | 0.5 days |
| 5. Testing | E2E testing | 0.5 days |
| **Total** | | **5 days** |

---

## Summary

**Cambio principal:** Usage tracking se mueve de on-chain a off-chain (PostgreSQL)

**Beneficios:**
- 💰 99%+ reducción en costos de gas
- ⚡ Respuestas instantáneas (no esperar confirmación)
- 📊 Mejor tracking y analytics
- 🔧 Más fácil de mantener

**Trade-offs:**
- Usuarios deben confiar en nuestra DB (mitigado con logs detallados)
- Menos "descentralizado" (pero más práctico)

**¿Listo para implementar?**
