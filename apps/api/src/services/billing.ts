import { ethers, Contract, JsonRpcProvider } from "ethers";

/**
 * ZeroPrompt Billing Service
 * Interacts with the on-chain billing contract
 */

// Contract ABI (minimal interface for read/write operations)
const BILLING_ABI = [
  // Read functions
  "function getBalance(address user) view returns (uint256)",
  "function getAccount(address user) view returns (tuple(uint256 creditsUSD, uint256 totalDeposited, uint256 totalUsedUSD, uint256 depositCount, uint256 lastDepositTime, uint256 lastUsageTime, bool isActive))",
  "function getNativeTokenPrice() view returns (uint256)",
  "function calculateCredits(uint256 amountNative) view returns (uint256)",
  "function calculateDeposit(uint256 amountUSD) view returns (uint256)",
  "function hasCredits(address user, uint256 amountUSD) view returns (bool)",
  "function getStats() view returns (uint256 totalUsers, uint256 totalDepositsUSD, uint256 totalUsageUSD, uint256 contractBalance, uint256 currentPrice)",
  "function getUserDeposits(address user) view returns (uint256[])",
  "function getUserUsage(address user) view returns (uint256[])",
  "function getDeposit(uint256 depositId) view returns (tuple(address user, uint256 amountNative, uint256 amountUSD, uint256 priceAtDeposit, uint256 timestamp, bytes32 txId))",
  "function getUsageRecord(uint256 usageId) view returns (tuple(address user, uint256 amountUSD, string model, uint256 inputTokens, uint256 outputTokens, uint256 timestamp, bytes32 requestId))",
  "function minDepositUSD() view returns (uint256)",
  "function freeCreditsUSD() view returns (uint256)",

  // Write functions (for backend operator)
  "function recordUsage(address user, uint256 amountUSD, string model, uint256 inputTokens, uint256 outputTokens, bytes32 requestId)",
  "function batchRecordUsage(address[] users, uint256[] amounts, string[] models, bytes32[] requestIds)",
  "function refundCredits(address user, uint256 amountUSD, string reason)",
  "function grantFreeCredits(address user, uint256 amountUSD)",

  // Owner/Admin functions
  "function owner() view returns (address)",
  "function withdraw(address to, uint256 amount)",
  "function setOperator(address operator, bool authorized)",
  "function isOperator(address operator) view returns (bool)",

  // Events
  "event UserRegistered(address indexed user, uint256 freeCredits, uint256 timestamp)",
  "event CreditsDeposited(address indexed user, uint256 amountNative, uint256 amountUSD, uint256 priceUsed, uint256 newBalance, uint256 depositId)",
  "event CreditsUsed(address indexed user, uint256 amountUSD, string model, uint256 inputTokens, uint256 outputTokens, uint256 remainingBalance, bytes32 requestId)",
  "event CreditsRefunded(address indexed user, uint256 amountUSD, string reason)",
  "event FundsWithdrawn(address indexed to, uint256 amount)",
  "event FreeCreditsGranted(address indexed user, uint256 amount)"
];

// Network configurations
interface NetworkConfig {
  name: string;
  rpcUrl: string;
  chainId: number;
  contractAddress: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorer: string;
  deploymentBlock?: number;  // Block number when contract was deployed
}

const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  avalanche: {
    name: "Avalanche C-Chain",
    rpcUrl: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
    chainId: 43114,
    contractAddress: process.env.ZEROPROMPT_BILLING_AVALANCHE || "",
    nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
    blockExplorer: "https://snowtrace.io",
    deploymentBlock: 72579057  // Block when contract was deployed
  },
  avalancheFuji: {
    name: "Avalanche Fuji",
    rpcUrl: process.env.AVALANCHE_FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
    chainId: 43113,
    contractAddress: process.env.ZEROPROMPT_BILLING_AVALANCHEFUJI || "",
    nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
    blockExplorer: "https://testnet.snowtrace.io"
  },
  ethereum: {
    name: "Ethereum",
    rpcUrl: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
    chainId: 1,
    contractAddress: process.env.ZEROPROMPT_BILLING_ETHEREUM || "",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://etherscan.io"
  },
  arbitrum: {
    name: "Arbitrum One",
    rpcUrl: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
    chainId: 42161,
    contractAddress: process.env.ZEROPROMPT_BILLING_ARBITRUM || "",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://arbiscan.io"
  },
  polygon: {
    name: "Polygon",
    rpcUrl: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
    chainId: 137,
    contractAddress: process.env.ZEROPROMPT_BILLING_POLYGON || "",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    blockExplorer: "https://polygonscan.com"
  },
  base: {
    name: "Base",
    rpcUrl: process.env.BASE_RPC_URL || "https://mainnet.base.org",
    chainId: 8453,
    contractAddress: process.env.ZEROPROMPT_BILLING_BASE || "",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorer: "https://basescan.org"
  }
};

// Default network (Avalanche first)
const DEFAULT_NETWORK = process.env.DEFAULT_BILLING_NETWORK || "avalanche";

export interface UserAccount {
  creditsUSD: string;      // USD in 18 decimals
  totalDeposited: string;  // Native token in wei
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

export interface WithdrawRecord {
  to: string;
  amount: string;
  blockNumber: number;
  transactionHash: string;
  timestamp?: number;
}

export interface DepositEvent {
  user: string;
  amountNative: string;
  amountUSD: string;
  priceUsed: string;
  newBalance: string;
  depositId: number;
  blockNumber: number;
  transactionHash: string;
  timestamp?: number;
}

export class BillingService {
  private providers: Map<string, JsonRpcProvider> = new Map();
  private contracts: Map<string, Contract> = new Map();
  private operatorWallet: ethers.Wallet | null = null;

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    const operatorKey = process.env.PRIVATE_KEY;

    for (const [networkId, config] of Object.entries(NETWORK_CONFIGS)) {
      if (!config.contractAddress) continue;

      try {
        const provider = new JsonRpcProvider(config.rpcUrl);
        this.providers.set(networkId, provider);

        // Create read-only contract
        const contract = new Contract(config.contractAddress, BILLING_ABI, provider);
        this.contracts.set(networkId, contract);

        // If we have operator key, create writable contract
        if (operatorKey) {
          const wallet = new ethers.Wallet(operatorKey, provider);
          const writableContract = new Contract(config.contractAddress, BILLING_ABI, wallet);
          this.contracts.set(`${networkId}_write`, writableContract);

          if (!this.operatorWallet) {
            this.operatorWallet = wallet;
          }
        }

        console.log(`[Billing] Initialized ${config.name} (${config.contractAddress})`);
      } catch (error) {
        console.error(`[Billing] Failed to initialize ${networkId}:`, error);
      }
    }
  }

  getNetworkConfig(networkId: string = DEFAULT_NETWORK): NetworkConfig | null {
    return NETWORK_CONFIGS[networkId] || null;
  }

  getSupportedNetworks(): { id: string; config: NetworkConfig }[] {
    return Object.entries(NETWORK_CONFIGS)
      .filter(([_, config]) => config.contractAddress)
      .map(([id, config]) => ({ id, config }));
  }

  private getContract(networkId: string = DEFAULT_NETWORK, writable = false): Contract {
    const key = writable ? `${networkId}_write` : networkId;
    const contract = this.contracts.get(key);
    if (!contract) {
      throw new Error(`Contract not available for network: ${networkId}`);
    }
    return contract;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // READ FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════

  async getBalance(userAddress: string, networkId: string = DEFAULT_NETWORK): Promise<string> {
    const contract = this.getContract(networkId);
    const balance = await contract.getBalance(userAddress);
    return ethers.formatEther(balance); // Convert from 18 decimals to USD string
  }

  async getAccount(userAddress: string, networkId: string = DEFAULT_NETWORK): Promise<UserAccount> {
    const contract = this.getContract(networkId);
    const account = await contract.getAccount(userAddress);

    return {
      creditsUSD: ethers.formatEther(account.creditsUSD),
      totalDeposited: ethers.formatEther(account.totalDeposited),
      totalUsedUSD: ethers.formatEther(account.totalUsedUSD),
      depositCount: Number(account.depositCount),
      lastDepositTime: Number(account.lastDepositTime),
      lastUsageTime: Number(account.lastUsageTime),
      isActive: account.isActive
    };
  }

  async getNativeTokenPrice(networkId: string = DEFAULT_NETWORK): Promise<number> {
    const contract = this.getContract(networkId);
    const price = await contract.getNativeTokenPrice();
    return Number(price) / 1e8; // Convert from 8 decimals
  }

  async calculateCredits(amountNative: string, networkId: string = DEFAULT_NETWORK): Promise<string> {
    const contract = this.getContract(networkId);
    const amountWei = ethers.parseEther(amountNative);
    const creditsUSD = await contract.calculateCredits(amountWei);
    return ethers.formatEther(creditsUSD);
  }

  async calculateDeposit(amountUSD: string, networkId: string = DEFAULT_NETWORK): Promise<string> {
    const contract = this.getContract(networkId);
    const amountUSDWei = ethers.parseEther(amountUSD);
    const nativeAmount = await contract.calculateDeposit(amountUSDWei);
    return ethers.formatEther(nativeAmount);
  }

  async hasCredits(userAddress: string, amountUSD: string, networkId: string = DEFAULT_NETWORK): Promise<boolean> {
    const contract = this.getContract(networkId);
    const amountWei = ethers.parseEther(amountUSD);
    return contract.hasCredits(userAddress, amountWei);
  }

  async getStats(networkId: string = DEFAULT_NETWORK) {
    const contract = this.getContract(networkId);
    const stats = await contract.getStats();

    return {
      totalUsers: Number(stats.totalUsers),
      totalDepositsUSD: ethers.formatEther(stats.totalDepositsUSD),
      totalUsageUSD: ethers.formatEther(stats.totalUsageUSD),
      contractBalance: ethers.formatEther(stats.contractBalance),
      currentPrice: Number(stats.currentPrice) / 1e8
    };
  }

  async getContractConfig(networkId: string = DEFAULT_NETWORK) {
    const contract = this.getContract(networkId);
    const [minDeposit, freeCredits] = await Promise.all([
      contract.minDepositUSD(),
      contract.freeCreditsUSD()
    ]);

    return {
      minDepositUSD: ethers.formatEther(minDeposit),
      freeCreditsUSD: ethers.formatEther(freeCredits)
    };
  }

  async getUserDeposits(userAddress: string, networkId: string = DEFAULT_NETWORK): Promise<DepositInfo[]> {
    const contract = this.getContract(networkId);
    const depositIds = await contract.getUserDeposits(userAddress);

    const deposits: DepositInfo[] = [];
    for (const id of depositIds) {
      const deposit = await contract.getDeposit(id);
      deposits.push({
        user: deposit.user,
        amountNative: ethers.formatEther(deposit.amountNative),
        amountUSD: ethers.formatEther(deposit.amountUSD),
        priceAtDeposit: (Number(deposit.priceAtDeposit) / 1e8).toString(),
        timestamp: Number(deposit.timestamp),
        txId: deposit.txId
      });
    }

    return deposits;
  }

  async getUserUsage(userAddress: string, networkId: string = DEFAULT_NETWORK): Promise<UsageRecord[]> {
    const contract = this.getContract(networkId);
    const usageIds = await contract.getUserUsage(userAddress);

    const usage: UsageRecord[] = [];
    for (const id of usageIds) {
      const record = await contract.getUsageRecord(id);
      usage.push({
        user: record.user,
        amountUSD: ethers.formatEther(record.amountUSD),
        model: record.model,
        inputTokens: Number(record.inputTokens),
        outputTokens: Number(record.outputTokens),
        timestamp: Number(record.timestamp),
        requestId: record.requestId
      });
    }

    return usage;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // WRITE FUNCTIONS (Operator only)
  // ═══════════════════════════════════════════════════════════════════════

  async recordUsage(
    userAddress: string,
    amountUSD: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    requestId: string,
    networkId: string = DEFAULT_NETWORK
  ): Promise<string> {
    const contract = this.getContract(networkId, true);
    const amountWei = ethers.parseEther(amountUSD);
    const requestIdBytes = ethers.keccak256(ethers.toUtf8Bytes(requestId));

    const tx = await contract.recordUsage(
      userAddress,
      amountWei,
      model,
      inputTokens,
      outputTokens,
      requestIdBytes
    );

    const receipt = await tx.wait();
    return receipt.hash;
  }

  async refundCredits(
    userAddress: string,
    amountUSD: string,
    reason: string,
    networkId: string = DEFAULT_NETWORK
  ): Promise<string> {
    const contract = this.getContract(networkId, true);
    const amountWei = ethers.parseEther(amountUSD);

    const tx = await contract.refundCredits(userAddress, amountWei, reason);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async grantFreeCredits(
    userAddress: string,
    amountUSD: string,
    networkId: string = DEFAULT_NETWORK
  ): Promise<string> {
    const contract = this.getContract(networkId, true);
    const amountWei = ethers.parseEther(amountUSD);

    const tx = await contract.grantFreeCredits(userAddress, amountWei);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TRANSACTION PREPARATION (for frontend signing)
  // ═══════════════════════════════════════════════════════════════════════

  prepareDepositTransaction(amountNative: string, networkId: string = DEFAULT_NETWORK) {
    const config = this.getNetworkConfig(networkId);
    if (!config || !config.contractAddress) {
      throw new Error(`Network ${networkId} not configured`);
    }

    const amountWei = ethers.parseEther(amountNative);

    // Encode the deposit() function call - this updates stats properly
    const iface = new ethers.Interface(["function deposit() payable"]);
    const data = iface.encodeFunctionData("deposit", []);

    return {
      to: config.contractAddress,
      value: amountWei.toString(),
      data,
      chainId: config.chainId,
      networkName: config.name,
      nativeCurrency: config.nativeCurrency
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ADMIN FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════

  async getOwner(networkId: string = DEFAULT_NETWORK): Promise<string> {
    const contract = this.getContract(networkId);
    return contract.owner();
  }

  async isOperator(address: string, networkId: string = DEFAULT_NETWORK): Promise<boolean> {
    const contract = this.getContract(networkId);
    return contract.isOperator(address);
  }

  async getContractBalance(networkId: string = DEFAULT_NETWORK): Promise<string> {
    const config = this.getNetworkConfig(networkId);
    if (!config) throw new Error(`Network ${networkId} not configured`);

    const provider = this.providers.get(networkId);
    if (!provider) throw new Error(`Provider not available for ${networkId}`);

    const balance = await provider.getBalance(config.contractAddress);
    return ethers.formatEther(balance);
  }

  prepareWithdrawTransaction(toAddress: string, amount: string, networkId: string = DEFAULT_NETWORK) {
    const config = this.getNetworkConfig(networkId);
    if (!config || !config.contractAddress) {
      throw new Error(`Network ${networkId} not configured`);
    }

    const amountWei = ethers.parseEther(amount);
    const iface = new ethers.Interface(BILLING_ABI);
    const data = iface.encodeFunctionData("withdraw", [toAddress, amountWei]);

    return {
      to: config.contractAddress,
      value: "0",
      data,
      chainId: config.chainId,
      networkName: config.name,
      nativeCurrency: config.nativeCurrency
    };
  }

  async getWithdrawHistory(networkId: string = DEFAULT_NETWORK): Promise<WithdrawRecord[]> {
    const config = this.getNetworkConfig(networkId);
    if (!config || !config.contractAddress) {
      throw new Error(`Network ${networkId} not configured`);
    }

    const provider = this.providers.get(networkId);
    if (!provider) {
      throw new Error(`Provider not available for ${networkId}`);
    }

    const contract = this.getContract(networkId);

    try {
      // Query FundsWithdrawn events with pagination (RPC limit is 2048 blocks)
      const filter = contract.filters.FundsWithdrawn();
      const fromBlock = config.deploymentBlock || 0;
      const latestBlock = await provider.getBlockNumber();
      const CHUNK_SIZE = 2000;

      const allEvents: any[] = [];

      for (let start = fromBlock; start <= latestBlock; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE - 1, latestBlock);
        const events = await contract.queryFilter(filter, start, end);
        allEvents.push(...events);
      }

      const withdrawals: WithdrawRecord[] = [];

      for (const event of allEvents) {
        const args = (event as any).args;
        const block = await event.getBlock();

        withdrawals.push({
          to: args.to,
          amount: ethers.formatEther(args.amount),
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          timestamp: block?.timestamp
        });
      }

      // Sort by block number descending (newest first)
      withdrawals.sort((a, b) => b.blockNumber - a.blockNumber);

      return withdrawals;
    } catch (error) {
      console.error(`[Billing] Failed to get withdraw history:`, error);
      return [];
    }
  }

  async getDepositHistory(networkId: string = DEFAULT_NETWORK): Promise<DepositEvent[]> {
    const config = this.getNetworkConfig(networkId);
    if (!config || !config.contractAddress) {
      throw new Error(`Network ${networkId} not configured`);
    }

    const provider = this.providers.get(networkId);
    if (!provider) {
      throw new Error(`Provider not available for ${networkId}`);
    }

    const contract = this.getContract(networkId);

    try {
      // Query CreditsDeposited events with pagination (RPC limit is 2048 blocks)
      const filter = contract.filters.CreditsDeposited();
      const fromBlock = config.deploymentBlock || 0;
      const latestBlock = await provider.getBlockNumber();
      const CHUNK_SIZE = 2000;

      const allEvents: any[] = [];

      for (let start = fromBlock; start <= latestBlock; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE - 1, latestBlock);
        const events = await contract.queryFilter(filter, start, end);
        allEvents.push(...events);
      }

      const deposits: DepositEvent[] = [];

      for (const event of allEvents) {
        const args = (event as any).args;
        const block = await event.getBlock();

        deposits.push({
          user: args.user,
          amountNative: ethers.formatEther(args.amountNative),
          amountUSD: ethers.formatEther(args.amountUSD),
          priceUsed: (Number(args.priceUsed) / 1e8).toString(),
          newBalance: ethers.formatEther(args.newBalance),
          depositId: Number(args.depositId),
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          timestamp: block?.timestamp
        });
      }

      // Sort by block number descending (newest first)
      deposits.sort((a, b) => b.blockNumber - a.blockNumber);

      return deposits;
    } catch (error) {
      console.error(`[Billing] Failed to get deposit history:`, error);
      return [];
    }
  }
}

// Singleton instance
export const billingService = new BillingService();
