import { ethers } from "ethers";
import { prisma } from "../prisma";
import { vaultService } from "./vault";

/**
 * ZeroPrompt Billing Service - Hybrid Billing
 *
 * Balance = Total Deposits (from DB, verified on-chain) - Total Usage (from DB)
 *
 * Deposits are verified instantly via txHash when frontend notifies backend.
 * No polling, no background sync - instant and robust.
 */

const DEFAULT_NETWORK = process.env.DEFAULT_BILLING_NETWORK || "avalanche";
const VAULT_ADDRESS = process.env.VAULT_CONTRACT_ADDRESS || '0x773c9849F15Ac7484232767536Fe5495B5E231e9';

export interface UserAccount {
  creditsUSD: string;
  totalDeposited: string;
  totalUsedUSD: string;
  depositCount: number;
  lastDepositTime: number;
  lastUsageTime: number;
  isActive: boolean;
}

export interface DepositInfo {
  user: string;
  amountNative: string;
  amountUSD: string;
  priceAtDeposit: string;
  timestamp: number;
  txId: string;
}

export interface UsageRecord {
  user: string;
  amountUSD: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  timestamp: number;
  requestId: string;
}

export class BillingService {

  // ═══════════════════════════════════════════════════════════════════════
  // DEPOSIT VERIFICATION (Instant - called by frontend after tx confirms)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Verify and process a deposit by transaction hash - INSTANT
   *
   * Flow:
   * 1. Frontend sends AVAX to vault contract
   * 2. Transaction confirms on-chain
   * 3. Frontend calls POST /billing/verify-deposit with txHash
   * 4. Backend verifies the tx, saves to DB, returns new balance
   * 5. Frontend shows updated balance immediately
   */
  async verifyAndProcessDeposit(txHash: string, expectedUser?: string): Promise<{
    success: boolean;
    newBalanceUSD: string;
    depositAmountUSD: string;
    depositAmountAVAX: string;
    message: string;
  }> {
    try {
      // Idempotent - check if already processed
      const existing = await prisma.vaultDeposit.findUnique({
        where: { txHash }
      });

      if (existing) {
        console.log(`[Billing] Deposit already processed: ${txHash}`);
        const balance = await this.getBalance(existing.walletAddress);
        return {
          success: true,
          newBalanceUSD: balance,
          depositAmountUSD: existing.amountUSD.toString(),
          depositAmountAVAX: ethers.formatEther(existing.amountAVAX),
          message: "Deposit already processed"
        };
      }

      // Verify on-chain
      const depositEvent = await vaultService.verifyDepositByTxHash(txHash);

      if (!depositEvent) {
        return {
          success: false,
          newBalanceUSD: "0",
          depositAmountUSD: "0",
          depositAmountAVAX: "0",
          message: "Transaction not found or not a valid deposit"
        };
      }

      // Security: verify user matches if provided
      if (expectedUser && depositEvent.user.toLowerCase() !== expectedUser.toLowerCase()) {
        console.warn(`[Billing] User mismatch: expected ${expectedUser}, got ${depositEvent.user}`);
        return {
          success: false,
          newBalanceUSD: "0",
          depositAmountUSD: "0",
          depositAmountAVAX: "0",
          message: "Deposit user does not match expected user"
        };
      }

      // Get AVAX price and calculate USD value
      const avaxPriceUSD = await this.getNativeTokenPrice();
      const amountUSD = parseFloat(depositEvent.amountFormatted) * avaxPriceUSD;

      console.log(`[Billing] Processing deposit: ${depositEvent.amountFormatted} AVAX = $${amountUSD.toFixed(2)}`);

      // Save to database
      await prisma.vaultDeposit.create({
        data: {
          walletAddress: depositEvent.user,
          amountAVAX: depositEvent.amount,
          amountUSD: amountUSD,
          txHash: depositEvent.txHash,
          depositId: depositEvent.depositId,
          blockNumber: depositEvent.blockNumber,
        },
      });

      // Get updated balance
      const newBalance = await this.getBalance(depositEvent.user);

      console.log(`[Billing] ✓ Deposit processed! ${depositEvent.user} new balance: $${newBalance}`);

      return {
        success: true,
        newBalanceUSD: newBalance,
        depositAmountUSD: amountUSD.toFixed(6),
        depositAmountAVAX: depositEvent.amountFormatted,
        message: "Deposit verified and processed successfully"
      };

    } catch (error: any) {
      console.error('[Billing] verifyAndProcessDeposit failed:', error);
      return {
        success: false,
        newBalanceUSD: "0",
        depositAmountUSD: "0",
        depositAmountAVAX: "0",
        message: error.message || "Failed to verify deposit"
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BALANCE & ACCOUNT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get user's current balance in USD
   * Balance = Total Deposits - Total Usage
   */
  async getBalance(userAddress: string, _networkId: string = DEFAULT_NETWORK): Promise<string> {
    try {
      const { totalDepositedUSD, totalUsedUSD } = await this.getUserStats(userAddress);
      const balance = Math.max(0, totalDepositedUSD - totalUsedUSD);
      return balance.toFixed(6);
    } catch (error) {
      console.error('[Billing] getBalance failed:', error);
      return "0";
    }
  }

  /**
   * Get detailed account info
   */
  async getAccount(userAddress: string, _networkId: string = DEFAULT_NETWORK): Promise<UserAccount> {
    const stats = await this.getUserStats(userAddress);

    return {
      creditsUSD: Math.max(0, stats.totalDepositedUSD - stats.totalUsedUSD).toFixed(6),
      totalDeposited: stats.totalDepositedNative.toFixed(4),
      totalUsedUSD: stats.totalUsedUSD.toFixed(6),
      depositCount: stats.depositCount,
      lastDepositTime: stats.lastDepositTime,
      lastUsageTime: stats.lastUsageTime,
      isActive: stats.totalDepositedUSD > 0
    };
  }

  /**
   * Check if user has enough credits
   */
  async hasCredits(userAddress: string, amountUSD: string, networkId: string = DEFAULT_NETWORK): Promise<boolean> {
    const balance = await this.getBalance(userAddress, networkId);
    return parseFloat(balance) >= parseFloat(amountUSD);
  }

  /**
   * Aggregate user stats from DB
   */
  private async getUserStats(userAddress: string) {
    const deposits = await prisma.vaultDeposit.aggregate({
      where: { walletAddress: userAddress.toLowerCase() },
      _sum: { amountUSD: true },
      _count: { id: true },
      _max: { createdAt: true }
    });

    const usage = await prisma.usage.aggregate({
      where: { walletAddress: userAddress.toLowerCase() },
      _sum: { costUSD: true },
      _max: { createdAt: true }
    });

    const totalDepositedUSD = Number(deposits._sum.amountUSD || 0);
    const totalUsedUSD = Number(usage._sum.costUSD || 0);

    return {
      totalDepositedUSD,
      totalDepositedNative: 0, // Simplified
      totalUsedUSD,
      depositCount: deposits._count.id,
      lastDepositTime: deposits._max?.createdAt ? Math.floor(deposits._max.createdAt.getTime() / 1000) : 0,
      lastUsageTime: usage._max?.createdAt ? Math.floor(usage._max.createdAt.getTime() / 1000) : 0
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRICE & CALCULATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get AVAX price in USD
   */
  async getNativeTokenPrice(_networkId: string = DEFAULT_NETWORK): Promise<number> {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=avalanche-2&vs_currencies=usd');
      const data = await response.json();
      return data['avalanche-2']?.usd || 35;
    } catch (error) {
      console.warn('[Billing] Price fetch failed, using fallback $35');
      return 35;
    }
  }

  /**
   * Calculate USD value for native amount
   */
  async calculateCredits(amountNative: string, _networkId: string = DEFAULT_NETWORK): Promise<string> {
    const price = await this.getNativeTokenPrice();
    return (parseFloat(amountNative) * price).toString();
  }

  /**
   * Calculate native amount for USD value
   */
  async calculateDeposit(amountUSD: string, _networkId: string = DEFAULT_NETWORK): Promise<string> {
    const price = await this.getNativeTokenPrice();
    return (parseFloat(amountUSD) / price).toString();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // USAGE RECORDING
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Record API usage in database
   */
  async recordUsage(
    userAddress: string,
    amountUSD: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    requestId: string,
    _networkId: string = DEFAULT_NETWORK
  ): Promise<void> {
    try {
      await prisma.usage.create({
        data: {
          walletAddress: userAddress.toLowerCase(),
          model,
          inputTokens,
          outputTokens,
          costUSD: parseFloat(amountUSD),
          requestId
        }
      });
      console.log(`[Billing] Usage recorded: ${userAddress} $${amountUSD} (${model})`);
    } catch (error) {
      console.error(`[Billing] Failed to record usage:`, error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HISTORY
  // ═══════════════════════════════════════════════════════════════════════

  async getUserDeposits(userAddress: string, _networkId: string = DEFAULT_NETWORK): Promise<DepositInfo[]> {
    const records = await prisma.vaultDeposit.findMany({
      where: { walletAddress: userAddress.toLowerCase() },
      orderBy: { createdAt: 'desc' }
    });

    return records.map(d => ({
      user: d.walletAddress,
      amountNative: ethers.formatEther(d.amountAVAX),
      amountUSD: d.amountUSD.toString(),
      priceAtDeposit: "0",
      timestamp: Math.floor(d.createdAt.getTime() / 1000),
      txId: d.txHash
    }));
  }

  async getUserUsage(userAddress: string, _networkId: string = DEFAULT_NETWORK): Promise<UsageRecord[]> {
    const records = await prisma.usage.findMany({
      where: { walletAddress: userAddress.toLowerCase() },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return records.map(u => ({
      user: u.walletAddress,
      amountUSD: u.costUSD.toString(),
      model: u.model,
      inputTokens: u.inputTokens,
      outputTokens: u.outputTokens,
      timestamp: Math.floor(u.createdAt.getTime() / 1000),
      requestId: u.requestId
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TRANSACTION PREP (for frontend)
  // ═══════════════════════════════════════════════════════════════════════

  prepareDepositTransaction(amountNative: string, _networkId: string = DEFAULT_NETWORK) {
    if (!VAULT_ADDRESS) throw new Error("Vault address not configured");

    const amountWei = ethers.parseEther(amountNative);
    const iface = new ethers.Interface(["function deposit() payable"]);
    const data = iface.encodeFunctionData("deposit", []);

    return {
      to: VAULT_ADDRESS,
      value: amountWei.toString(),
      data,
      chainId: 43114,
      networkName: "Avalanche C-Chain",
      nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 }
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CONFIG & STATS
  // ═══════════════════════════════════════════════════════════════════════

  getNetworkConfig(_networkId: string = DEFAULT_NETWORK) {
    return {
      name: "Avalanche C-Chain",
      contractAddress: VAULT_ADDRESS || "",
      nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
      blockExplorer: "https://snowtrace.io"
    };
  }

  getSupportedNetworks() {
    return [{
      id: "avalanche",
      config: this.getNetworkConfig("avalanche")
    }];
  }

  async getStats(_networkId: string = DEFAULT_NETWORK) {
    const userCount = await prisma.user.count();
    const depositSum = await prisma.vaultDeposit.aggregate({ _sum: { amountUSD: true } });
    const usageSum = await prisma.usage.aggregate({ _sum: { costUSD: true } });

    return {
      totalUsers: userCount,
      totalDepositsUSD: depositSum._sum.amountUSD?.toString() || "0",
      totalUsageUSD: usageSum._sum.costUSD?.toString() || "0",
      contractBalance: "0",
      currentPrice: await this.getNativeTokenPrice()
    };
  }

  async getContractConfig(_networkId: string = DEFAULT_NETWORK) {
    return {
      minDepositUSD: "1.0",
      freeCreditsUSD: "0.5"
    };
  }

  // Legacy stubs
  async refundCredits(_user: string, _amount: string, _reason: string) { return "0x0"; }
  async grantFreeCredits(_user: string, _amount: string) { return "0x0"; }
  async getOwner(_networkId: string) { return "0x0000000000000000000000000000000000000000"; }
  async isOperator(_address: string) { return false; }
  async getContractBalance(_networkId: string) { return "0"; }
  prepareWithdrawTransaction(_to: string, _amount: string, _net: string) { return {}; }
  async getWithdrawHistory(_net: string) { return []; }
  async getDepositHistory(_net: string) { return []; }
}

export const billingService = new BillingService();
