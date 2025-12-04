import { Router, Request, Response } from "express";
import { billingService } from "../services/billing";
import { checkAuth } from "../middleware/auth";
import {
  FREE_GUEST_CREDITS,
  getGuestCredits,
  getGuestUsage
} from "../services/guestCredits";

export const billingRouter = Router();

// Apply auth middleware to all routes
billingRouter.use(checkAuth);

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC READ ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /billing/networks
 * Get list of supported networks
 */
billingRouter.get("/networks", async (_req: Request, res: Response) => {
  try {
    const networks = billingService.getSupportedNetworks();
    res.json({ networks });
  } catch (error: any) {
    console.error("[Billing] Get networks error:", error);
    res.status(500).json({ error: "failed_to_get_networks" });
  }
});

/**
 * GET /billing/price/:networkId?
 * Get current native token price in USD
 */
billingRouter.get("/price/:networkId?", async (req: Request, res: Response) => {
  try {
    const networkId = req.params.networkId;
    const price = await billingService.getNativeTokenPrice(networkId);
    const config = billingService.getNetworkConfig(networkId);

    res.json({
      price,
      currency: config?.nativeCurrency.symbol || "NATIVE",
      networkId: networkId || "default"
    });
  } catch (error: any) {
    console.error("[Billing] Get price error:", error);
    res.status(500).json({ error: "failed_to_get_price" });
  }
});

/**
 * GET /billing/config/:networkId?
 * Get contract configuration (min deposit, free credits)
 */
billingRouter.get("/config/:networkId?", async (req: Request, res: Response) => {
  try {
    const networkId = req.params.networkId;
    const config = await billingService.getContractConfig(networkId);
    const networkConfig = billingService.getNetworkConfig(networkId);

    res.json({
      ...config,
      network: networkConfig
    });
  } catch (error: any) {
    console.error("[Billing] Get config error:", error);
    res.status(500).json({ error: "failed_to_get_config" });
  }
});

/**
 * GET /billing/stats/:networkId?
 * Get platform statistics
 */
billingRouter.get("/stats/:networkId?", async (req: Request, res: Response) => {
  try {
    const networkId = req.params.networkId;
    const stats = await billingService.getStats(networkId);

    res.json({ stats });
  } catch (error: any) {
    console.error("[Billing] Get stats error:", error);
    res.status(500).json({ error: "failed_to_get_stats" });
  }
});

/**
 * GET /billing/calculate-credits/:amount/:networkId?
 * Calculate USD credits for a given native token amount
 */
billingRouter.get("/calculate-credits/:amount/:networkId?", async (req: Request, res: Response) => {
  try {
    const { amount, networkId } = req.params;
    const creditsUSD = await billingService.calculateCredits(amount, networkId);
    const config = billingService.getNetworkConfig(networkId);

    res.json({
      amountNative: amount,
      creditsUSD,
      currency: config?.nativeCurrency.symbol || "NATIVE"
    });
  } catch (error: any) {
    console.error("[Billing] Calculate credits error:", error);
    res.status(500).json({ error: "failed_to_calculate_credits" });
  }
});

/**
 * GET /billing/calculate-deposit/:amountUSD/:networkId?
 * Calculate native token amount needed for given USD credits
 */
billingRouter.get("/calculate-deposit/:amountUSD/:networkId?", async (req: Request, res: Response) => {
  try {
    const { amountUSD, networkId } = req.params;
    const amountNative = await billingService.calculateDeposit(amountUSD, networkId);
    const config = billingService.getNetworkConfig(networkId);

    res.json({
      amountUSD,
      amountNative,
      currency: config?.nativeCurrency.symbol || "NATIVE"
    });
  } catch (error: any) {
    console.error("[Billing] Calculate deposit error:", error);
    res.status(500).json({ error: "failed_to_calculate_deposit" });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// USER-SPECIFIC ENDPOINTS (Require wallet address)
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /billing/balance/:address/:networkId?
 * Get user's credit balance
 */
billingRouter.get("/balance/:address/:networkId?", async (req: Request, res: Response) => {
  try {
    const { address, networkId } = req.params;
    const balance = await billingService.getBalance(address, networkId);

    res.json({
      address,
      balanceUSD: balance,
      networkId: networkId || "default"
    });
  } catch (error: any) {
    console.error("[Billing] Get balance error:", error);
    res.status(500).json({ error: "failed_to_get_balance" });
  }
});

/**
 * GET /billing/account/:address/:networkId?
 * Get full user account info
 */
billingRouter.get("/account/:address/:networkId?", async (req: Request, res: Response) => {
  try {
    const { address, networkId } = req.params;
    const account = await billingService.getAccount(address, networkId);

    res.json({
      address,
      account,
      networkId: networkId || "default"
    });
  } catch (error: any) {
    console.error("[Billing] Get account error:", error);
    res.status(500).json({ error: "failed_to_get_account" });
  }
});

/**
 * GET /billing/has-credits/:address/:amountUSD/:networkId?
 * Check if user has sufficient credits
 */
billingRouter.get("/has-credits/:address/:amountUSD/:networkId?", async (req: Request, res: Response) => {
  try {
    const { address, amountUSD, networkId } = req.params;
    const hasCredits = await billingService.hasCredits(address, amountUSD, networkId);

    res.json({
      address,
      amountUSD,
      hasCredits
    });
  } catch (error: any) {
    console.error("[Billing] Check credits error:", error);
    res.status(500).json({ error: "failed_to_check_credits" });
  }
});

/**
 * GET /billing/deposits/:address/:networkId?
 * Get user's deposit history
 */
billingRouter.get("/deposits/:address/:networkId?", async (req: Request, res: Response) => {
  try {
    const { address, networkId } = req.params;
    const deposits = await billingService.getUserDeposits(address, networkId);

    res.json({
      address,
      deposits,
      count: deposits.length
    });
  } catch (error: any) {
    console.error("[Billing] Get deposits error:", error);
    res.status(500).json({ error: "failed_to_get_deposits" });
  }
});

/**
 * GET /billing/usage/:address/:networkId?
 * Get user's usage history
 */
billingRouter.get("/usage/:address/:networkId?", async (req: Request, res: Response) => {
  try {
    const { address, networkId } = req.params;
    const usage = await billingService.getUserUsage(address, networkId);

    res.json({
      address,
      usage,
      count: usage.length
    });
  } catch (error: any) {
    console.error("[Billing] Get usage error:", error);
    res.status(500).json({ error: "failed_to_get_usage" });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// TRANSACTION VERIFICATION - INSTANT BALANCE UPDATE
// ═══════════════════════════════════════════════════════════════════════

/**
 * POST /billing/verify-deposit
 * Verify a deposit transaction and update balance IMMEDIATELY
 * This should be called by frontend right after tx confirmation.
 *
 * Body: { txHash: string, userAddress?: string }
 *
 * This is the ROBUST way to update balance - no polling needed!
 */
billingRouter.post("/verify-deposit", async (req: Request, res: Response) => {
  try {
    const { txHash, userAddress } = req.body;
    const user = (req as any).user;

    if (!txHash) {
      return res.status(400).json({ error: "txHash_required" });
    }

    // Use the authenticated user's wallet, or fallback to provided userAddress
    const expectedUser = user?.walletAddress || userAddress;

    console.log(`[Billing] Verify deposit request: ${txHash} for ${expectedUser || 'any user'}`);

    const result = await billingService.verifyAndProcessDeposit(txHash, expectedUser);

    if (result.success) {
      res.json({
        success: true,
        newBalanceUSD: result.newBalanceUSD,
        depositAmountUSD: result.depositAmountUSD,
        depositAmountAVAX: result.depositAmountAVAX,
        message: result.message,
        txHash
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
        txHash
      });
    }
  } catch (error: any) {
    console.error("[Billing] Verify deposit error:", error);
    res.status(500).json({
      error: "failed_to_verify_deposit",
      message: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// TRANSACTION PREPARATION (For frontend signing)
// ═══════════════════════════════════════════════════════════════════════

/**
 * POST /billing/prepare-deposit
 * Prepare a deposit transaction for frontend signing
 * Body: { amountNative: string, networkId?: string }
 */
billingRouter.post("/prepare-deposit", async (req: Request, res: Response) => {
  try {
    const { amountNative, networkId } = req.body;

    if (!amountNative) {
      return res.status(400).json({ error: "amount_required" });
    }

    const tx = billingService.prepareDepositTransaction(amountNative, networkId);
    const creditsUSD = await billingService.calculateCredits(amountNative, networkId);

    res.json({
      transaction: tx,
      estimatedCreditsUSD: creditsUSD
    });
  } catch (error: any) {
    console.error("[Billing] Prepare deposit error:", error);
    res.status(500).json({ error: "failed_to_prepare_deposit" });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// AUTHENTICATED USER ENDPOINTS (Current logged-in user)
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /billing/credits/:networkId?
 * Get current user's credit balance (works for both guest and wallet users)
 * This is the unified endpoint for frontend to check credits
 */
billingRouter.get("/credits/:networkId?", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const guestId = req.headers["x-guest-id"] as string;
    const networkId = req.params.networkId;

    // Guest user - return credits from shared service
    if (!user?.walletAddress) {
      const remainingCredits = getGuestCredits(guestId);
      const usedCredits = getGuestUsage(guestId);

      return res.json({
        isGuest: true,
        guestId: guestId || null,
        balanceUSD: remainingCredits.toFixed(6),
        totalCredits: FREE_GUEST_CREDITS.toFixed(6),
        usedCredits: usedCredits.toFixed(6),
        canDeposit: false,
        message: "Connect your wallet to add more credits"
      });
    }

    // Wallet connected user - get on-chain balance
    const balance = await billingService.getBalance(user.walletAddress, networkId);

    res.json({
      isGuest: false,
      walletAddress: user.walletAddress,
      balanceUSD: balance,
      canDeposit: true,
      networkId: networkId || "default"
    });
  } catch (error: any) {
    console.error("[Billing] Get credits error:", error);
    res.status(500).json({ error: "failed_to_get_credits" });
  }
});

/**
 * GET /billing/me/:networkId?
 * Get current user's billing info (requires auth)
 */
billingRouter.get("/me/:networkId?", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    if (!user?.walletAddress) {
      return res.status(401).json({
        error: "wallet_required",
        message: "Please connect your wallet to view billing info"
      });
    }

    const networkId = req.params.networkId;
    const [account, deposits, usage] = await Promise.all([
      billingService.getAccount(user.walletAddress, networkId),
      billingService.getUserDeposits(user.walletAddress, networkId),
      billingService.getUserUsage(user.walletAddress, networkId)
    ]);

    res.json({
      wallet: user.walletAddress,
      account,
      deposits: deposits.slice(-10), // Last 10 deposits
      usage: usage.slice(-20), // Last 20 usage records
      networkId: networkId || "default"
    });
  } catch (error: any) {
    console.error("[Billing] Get my billing error:", error);
    res.status(500).json({ error: "failed_to_get_billing_info" });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// INTERNAL/OPERATOR ENDPOINTS (For backend usage recording)
// ═══════════════════════════════════════════════════════════════════════

/**
 * POST /billing/record-usage (Internal - called by LLM routes)
 * Record API usage for a user
 * Body: { userAddress, amountUSD, model, inputTokens, outputTokens, requestId, networkId? }
 */
billingRouter.post("/record-usage", async (req: Request, res: Response) => {
  try {
    // This should be protected by internal API key in production
    const internalKey = req.headers["x-internal-key"];
    if (internalKey !== process.env.INTERNAL_API_KEY && process.env.NODE_ENV === "production") {
      return res.status(403).json({ error: "forbidden" });
    }

    const { userAddress, amountUSD, model, inputTokens, outputTokens, requestId, networkId } = req.body;

    if (!userAddress || !amountUSD || !model || !requestId) {
      return res.status(400).json({ error: "missing_required_fields" });
    }

    const txHash = await billingService.recordUsage(
      userAddress,
      amountUSD,
      model,
      inputTokens || 0,
      outputTokens || 0,
      requestId,
      networkId
    );

    res.json({
      success: true,
      txHash,
      userAddress,
      amountUSD
    });
  } catch (error: any) {
    console.error("[Billing] Record usage error:", error);
    res.status(500).json({ error: "failed_to_record_usage", message: error.message });
  }
});

/**
 * POST /billing/refund (Internal - operator only)
 * Refund credits to a user
 * Body: { userAddress, amountUSD, reason, networkId? }
 */
billingRouter.post("/refund", async (req: Request, res: Response) => {
  try {
    const internalKey = req.headers["x-internal-key"];
    if (internalKey !== process.env.INTERNAL_API_KEY && process.env.NODE_ENV === "production") {
      return res.status(403).json({ error: "forbidden" });
    }

    const { userAddress, amountUSD, reason } = req.body;

    if (!userAddress || !amountUSD || !reason) {
      return res.status(400).json({ error: "missing_required_fields" });
    }

    const txHash = await billingService.refundCredits(userAddress, amountUSD, reason);

    res.json({
      success: true,
      txHash,
      userAddress,
      amountUSD,
      reason
    });
  } catch (error: any) {
    console.error("[Billing] Refund error:", error);
    res.status(500).json({ error: "failed_to_refund", message: error.message });
  }
});

/**
 * POST /billing/grant-credits (Internal - operator only)
 * Grant free credits to a user
 * Body: { userAddress, amountUSD, networkId? }
 */
billingRouter.post("/grant-credits", async (req: Request, res: Response) => {
  try {
    const internalKey = req.headers["x-internal-key"];
    if (internalKey !== process.env.INTERNAL_API_KEY && process.env.NODE_ENV === "production") {
      return res.status(403).json({ error: "forbidden" });
    }

    const { userAddress, amountUSD } = req.body;

    if (!userAddress || !amountUSD) {
      return res.status(400).json({ error: "missing_required_fields" });
    }

    const txHash = await billingService.grantFreeCredits(userAddress, amountUSD);

    res.json({
      success: true,
      txHash,
      userAddress,
      amountUSD
    });
  } catch (error: any) {
    console.error("[Billing] Grant credits error:", error);
    res.status(500).json({ error: "failed_to_grant_credits", message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS (For contract owner)
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /billing/admin/info/:networkId?
 * Get admin info (owner, contract balance, stats)
 */
billingRouter.get("/admin/info/:networkId?", async (req: Request, res: Response) => {
  try {
    const networkId = req.params.networkId;

    const [owner, contractBalance, stats, config] = await Promise.all([
      billingService.getOwner(networkId),
      billingService.getContractBalance(networkId),
      billingService.getStats(networkId),
      billingService.getContractConfig(networkId)
    ]);

    const networkConfig = billingService.getNetworkConfig(networkId);

    res.json({
      owner,
      contractBalance,
      contractAddress: networkConfig?.contractAddress,
      networkName: networkConfig?.name,
      currency: networkConfig?.nativeCurrency.symbol,
      stats,
      config,
      networkId: networkId || "default"
    });
  } catch (error: any) {
    console.error("[Billing] Admin info error:", error);
    res.status(500).json({ error: "failed_to_get_admin_info", message: error.message });
  }
});

/**
 * GET /billing/admin/is-owner/:address/:networkId?
 * Check if an address is the contract owner
 */
billingRouter.get("/admin/is-owner/:address/:networkId?", async (req: Request, res: Response) => {
  try {
    const { address, networkId } = req.params;
    const owner = await billingService.getOwner(networkId);
    const isOwner = owner.toLowerCase() === address.toLowerCase();

    res.json({
      address,
      owner,
      isOwner
    });
  } catch (error: any) {
    console.error("[Billing] Check owner error:", error);
    res.status(500).json({ error: "failed_to_check_owner", message: error.message });
  }
});

/**
 * POST /billing/admin/prepare-withdraw
 * Prepare a withdraw transaction for owner signing
 * Body: { toAddress: string, amount: string, networkId?: string }
 * Note: toAddress is where the funds will be sent, amount is in native token (e.g. AVAX)
 */
billingRouter.post("/admin/prepare-withdraw", async (req: Request, res: Response) => {
  try {
    const { toAddress, amount, networkId } = req.body;

    if (!toAddress) {
      return res.status(400).json({ error: "to_address_required" });
    }
    if (!amount) {
      return res.status(400).json({ error: "amount_required" });
    }

    const tx = billingService.prepareWithdrawTransaction(toAddress, amount, networkId);
    const contractBalance = await billingService.getContractBalance(networkId);

    res.json({
      transaction: tx,
      toAddress,
      amount,
      contractBalance
    });
  } catch (error: any) {
    console.error("[Billing] Prepare withdraw error:", error);
    res.status(500).json({ error: "failed_to_prepare_withdraw", message: error.message });
  }
});

/**
 * GET /billing/admin/withdrawals/:networkId?
 * Get withdraw history from blockchain events
 */
billingRouter.get("/admin/withdrawals/:networkId?", async (req: Request, res: Response) => {
  try {
    const networkId = req.params.networkId;
    const withdrawals = await billingService.getWithdrawHistory(networkId);
    const networkConfig = billingService.getNetworkConfig(networkId);

    res.json({
      withdrawals,
      count: withdrawals.length,
      currency: networkConfig?.nativeCurrency.symbol,
      blockExplorer: networkConfig?.blockExplorer,
      networkId: networkId || "default"
    });
  } catch (error: any) {
    console.error("[Billing] Get withdrawals error:", error);
    res.status(500).json({ error: "failed_to_get_withdrawals", message: error.message });
  }
});

/**
 * GET /billing/admin/deposit-events/:networkId?
 * Get all deposit events from blockchain (via CreditsDeposited events)
 */
billingRouter.get("/admin/deposit-events/:networkId?", async (req: Request, res: Response) => {
  try {
    const networkId = req.params.networkId;
    const deposits = await billingService.getDepositHistory(networkId);
    const networkConfig = billingService.getNetworkConfig(networkId);

    res.json({
      deposits,
      count: deposits.length,
      currency: networkConfig?.nativeCurrency.symbol,
      blockExplorer: networkConfig?.blockExplorer,
      networkId: networkId || "default"
    });
  } catch (error: any) {
    console.error("[Billing] Get deposit events error:", error);
    res.status(500).json({ error: "failed_to_get_deposit_events", message: error.message });
  }
});
