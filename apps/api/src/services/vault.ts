import { ethers } from 'ethers';

// ----------------------------------------------------------------
// CONFIGURATION
// ----------------------------------------------------------------
const RPC_URL = process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc';
const VAULT_ADDRESS = process.env.VAULT_CONTRACT_ADDRESS || '0x773c9849F15Ac7484232767536Fe5495B5E231e9';
const OPERATOR_PRIVATE_KEY = process.env.PRIVATE_KEY;
const CHAIN_ID = 43114;

// Vault ABI (minimal for what we need)
const VAULT_ABI = [
  'event Deposited(address indexed user, uint256 amount, uint256 indexed depositId, uint256 timestamp)',
  'event Withdrawn(address indexed user, uint256 amount, uint256 indexed nonce, uint256 timestamp)',
  'function nonces(address) view returns (uint256)',
  'function getWithdrawalHash(address user, uint256 amount, uint256 deadline) view returns (bytes32)',
  'function getContractBalance() view returns (uint256)',
  'function totalDeposited(address) view returns (uint256)',
  'function depositCount() view returns (uint256)',
];

export interface DepositEvent {
  user: string;
  amount: string;
  amountFormatted: string;
  depositId: number;
  timestamp: number;
  txHash: string;
  blockNumber: number;
}

/**
 * VaultService - Manages the ZeroPromptVault contract interactions
 *
 * Deposits are verified directly by txHash when frontend notifies backend.
 * No polling needed - instant verification.
 */
export class VaultService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract | null = null;
  private operatorWallet: ethers.Wallet | null = null;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);

    if (VAULT_ADDRESS) {
      this.contract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, this.provider);
      console.log(`[Vault] Initialized with contract: ${VAULT_ADDRESS}`);
    } else {
      console.warn('[Vault] VAULT_CONTRACT_ADDRESS not set, vault service disabled');
    }

    if (OPERATOR_PRIVATE_KEY) {
      this.operatorWallet = new ethers.Wallet(OPERATOR_PRIVATE_KEY, this.provider);
      console.log(`[Vault] Operator address: ${this.operatorWallet.address}`);
    } else {
      console.warn('[Vault] PRIVATE_KEY not set, withdrawal signing disabled');
    }
  }

  /**
   * Check if vault service is enabled
   */
  isEnabled(): boolean {
    return this.contract !== null;
  }

  /**
   * Check if signing is enabled (for withdrawals)
   */
  canSign(): boolean {
    return this.operatorWallet !== null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // READ FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get user's nonce for withdrawal permit
   */
  async getNonce(userAddress: string): Promise<number> {
    if (!this.contract) throw new Error('Vault not initialized');
    const nonce = await this.contract.nonces(userAddress);
    return Number(nonce);
  }

  /**
   * Get contract's total AVAX balance
   */
  async getContractBalance(): Promise<string> {
    if (!this.contract) throw new Error('Vault not initialized');
    const balance = await this.contract.getContractBalance();
    return ethers.formatEther(balance);
  }

  /**
   * Get user's total deposited amount (from contract state)
   */
  async getUserTotalDeposited(userAddress: string): Promise<string> {
    if (!this.contract) throw new Error('Vault not initialized');
    const total = await this.contract.totalDeposited(userAddress);
    return ethers.formatEther(total);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DEPOSIT VERIFICATION (Direct by txHash - no polling!)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Verify a deposit transaction by txHash
   *
   * Waits for confirmation if tx is pending, then verifies.
   */
  async verifyDepositByTxHash(txHash: string): Promise<DepositEvent | null> {
    if (!this.contract) throw new Error('Vault not initialized');

    try {
      console.log(`[Vault] Verifying deposit tx: ${txHash}`);

      // First try to get receipt directly
      let receipt = await this.provider.getTransactionReceipt(txHash);

      // If not found, wait for it (tx might be pending)
      if (!receipt) {
        console.log(`[Vault] Tx pending, waiting for confirmation...`);
        try {
          receipt = await this.provider.waitForTransaction(txHash, 1, 60000); // 1 confirmation, 60s timeout
        } catch (waitErr) {
          console.log(`[Vault] Timeout waiting for tx: ${txHash}`);
          return null;
        }
      }

      if (!receipt) {
        console.log(`[Vault] Transaction not found: ${txHash}`);
        return null;
      }

      if (receipt.status === 0) {
        console.log(`[Vault] Transaction failed: ${txHash}`);
        return null;
      }

      if (receipt.to?.toLowerCase() !== VAULT_ADDRESS?.toLowerCase()) {
        console.log(`[Vault] Transaction not to vault contract: ${txHash}`);
        return null;
      }

      // Parse logs to find Deposited event
      const iface = new ethers.Interface(VAULT_ABI);

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== VAULT_ADDRESS?.toLowerCase()) continue;

        try {
          const parsed = iface.parseLog({
            topics: log.topics as string[],
            data: log.data
          });

          if (parsed && parsed.name === 'Deposited') {
            const depositEvent: DepositEvent = {
              user: parsed.args[0].toLowerCase(),
              amount: parsed.args[1].toString(),
              amountFormatted: ethers.formatEther(parsed.args[1]),
              depositId: Number(parsed.args[2]),
              timestamp: Number(parsed.args[3]),
              txHash: receipt.hash,
              blockNumber: receipt.blockNumber,
            };

            console.log(`[Vault] ✓ Verified deposit: ${depositEvent.user} - ${depositEvent.amountFormatted} AVAX`);
            return depositEvent;
          }
        } catch {
          continue;
        }
      }

      console.log(`[Vault] No Deposited event found in tx: ${txHash}`);
      return null;

    } catch (error) {
      console.error(`[Vault] Error verifying tx ${txHash}:`, error);
      throw error;
    }
  }

  /**
   * Wait for transaction confirmation then verify
   * Use when tx might still be pending
   */
  async waitAndVerifyDeposit(txHash: string, confirmations: number = 1): Promise<DepositEvent | null> {
    if (!this.contract) throw new Error('Vault not initialized');

    try {
      console.log(`[Vault] Waiting for tx confirmation: ${txHash}`);

      const receipt = await this.provider.waitForTransaction(txHash, confirmations, 60000);

      if (!receipt || receipt.status === 0) {
        console.log(`[Vault] Transaction failed or timed out: ${txHash}`);
        return null;
      }

      return this.verifyDepositByTxHash(txHash);

    } catch (error) {
      console.error(`[Vault] Error waiting for tx ${txHash}:`, error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // WITHDRAWAL SIGNING
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Sign a withdrawal permit for a user
   */
  async signWithdrawalPermit(
    userAddress: string,
    amountWei: string,
    deadlineSeconds: number = 3600
  ): Promise<{
    signature: string;
    amount: string;
    deadline: number;
    nonce: number;
    userAddress: string;
    contractAddress: string;
    chainId: number;
  }> {
    if (!this.contract || !this.operatorWallet) {
      throw new Error('Vault not initialized or signing disabled');
    }

    const nonce = await this.getNonce(userAddress);
    const deadline = Math.floor(Date.now() / 1000) + deadlineSeconds;

    const messageHash = ethers.solidityPackedKeccak256(
      ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
      [VAULT_ADDRESS, userAddress, amountWei, nonce, deadline, CHAIN_ID]
    );

    const signature = await this.operatorWallet.signMessage(ethers.getBytes(messageHash));

    console.log(`[Vault] Signed withdrawal permit for ${userAddress}: ${ethers.formatEther(amountWei)} AVAX`);

    return {
      signature,
      amount: amountWei,
      deadline,
      nonce,
      userAddress,
      contractAddress: VAULT_ADDRESS!,
      chainId: CHAIN_ID,
    };
  }
}

export const vaultService = new VaultService();
