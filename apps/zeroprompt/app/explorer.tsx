import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { ethers } from "ethers";
import {
  SUBNET_CHAIN_ID,
  SUBNET_RPC,
  ZEROP_TOKEN_ADDRESS,
  OPERATOR_REGISTRY_ADDRESS,
  SUBNET_REWARDS_ADDRESS,
  ERC20_ABI,
  OPERATOR_REGISTRY_ABI,
  SUBNET_REWARDS_ABI,
  getSubnetProvider,
} from "../lib/subnetContracts";
import {
  ArrowLeft,
  Search,
  ArrowRightLeft,
  FileCode,
  Home,
  ChevronRight,
  ChevronLeft,
  Fuel,
  Layers,
  Copy,
  AlertTriangle,
  CheckCircle,
  XCircle,
  User,
  Activity,
  Database,
  RefreshCw,
  Code,
  Eye,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react-native";

// ─── Types ───────────────────────────────────────────────────────────

type ExplorerView =
  | "overview"
  | "blocks"
  | "block-detail"
  | "transactions"
  | "tx-detail"
  | "contracts"
  | "contract-detail"
  | "address";

interface BlockSummary {
  number: number;
  hash: string;
  timestamp: number;
  transactions: number;
  gasUsed: string;
  gasLimit: string;
  miner: string;
  baseFeePerGas: string | null;
}

interface BlockDetail extends BlockSummary {
  parentHash: string;
  nonce: string;
  extraData: string;
  size: number;
  stateRoot: string;
  transactionsRoot: string;
  receiptsRoot: string;
  logsBloom: string;
  txHashes: string[];
}

interface TxSummary {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  blockNumber: number;
  timestamp: number;
  gasUsed: string;
  status: boolean;
  methodId: string;
}

interface TxDetail extends TxSummary {
  gasPrice: string;
  gasLimit: string;
  nonce: number;
  transactionIndex: number;
  input: string;
  fee: string;
  logs: LogEntry[];
  decodedInput: DecodedData | null;
}

interface LogEntry {
  address: string;
  topics: string[];
  data: string;
  logIndex: number;
  decoded: DecodedData | null;
}

interface DecodedData {
  name: string;
  args: { name: string; value: string }[];
}

interface ContractInfo {
  name: string;
  address: string;
  type: string;
  color: string;
  abi: readonly any[];
  readFunctions: ReadFunction[];
}

interface ReadFunction {
  name: string;
  inputs: { name: string; type: string }[];
  outputs: { name: string; type: string }[];
}

interface ReadFunctionResult {
  name: string;
  result: string | null;
  error: string | null;
  loading: boolean;
}

// ─── Contract definitions ────────────────────────────────────────────

const CONTRACTS: ContractInfo[] = [
  {
    name: "ZEROP Token",
    address: ZEROP_TOKEN_ADDRESS,
    type: "ERC-20",
    color: "#00FF41",
    abi: ERC20_ABI,
    readFunctions: [
      {
        name: "balanceOf",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "balance", type: "uint256" }],
      },
      {
        name: "allowance",
        inputs: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
        ],
        outputs: [{ name: "remaining", type: "uint256" }],
      },
    ],
  },
  {
    name: "Operator Registry",
    address: OPERATOR_REGISTRY_ADDRESS,
    type: "Staking",
    color: "#2196F3",
    abi: OPERATOR_REGISTRY_ABI,
    readFunctions: [
      {
        name: "getOperator",
        inputs: [{ name: "operator", type: "address" }],
        outputs: [
          { name: "endpoint", type: "string" },
          { name: "supportedModels", type: "string[]" },
          { name: "isRegistered", type: "bool" },
          { name: "registeredAt", type: "uint256" },
          { name: "lastUpdated", type: "uint256" },
        ],
      },
      {
        name: "getOperatorDetails",
        inputs: [{ name: "operator", type: "address" }],
        outputs: [
          { name: "stakeAmount", type: "uint256" },
          { name: "performanceScore", type: "uint256" },
          { name: "isActive", type: "bool" },
        ],
      },
      {
        name: "isOperatorActive",
        inputs: [{ name: "operator", type: "address" }],
        outputs: [{ name: "active", type: "bool" }],
      },
      {
        name: "getActiveOperatorCount",
        inputs: [],
        outputs: [{ name: "count", type: "uint256" }],
      },
      {
        name: "MIN_STAKE_AMOUNT",
        inputs: [],
        outputs: [{ name: "amount", type: "uint256" }],
      },
    ],
  },
  {
    name: "Subnet Rewards",
    address: SUBNET_REWARDS_ADDRESS,
    type: "Rewards",
    color: "#4CAF50",
    abi: SUBNET_REWARDS_ABI,
    readFunctions: [
      {
        name: "getPendingRewards",
        inputs: [{ name: "operator", type: "address" }],
        outputs: [{ name: "rewards", type: "uint256" }],
      },
      {
        name: "getGlobalEpochStats",
        inputs: [],
        outputs: [
          { name: "epoch", type: "uint256" },
          { name: "totalRewards", type: "uint256" },
          { name: "totalStaked", type: "uint256" },
        ],
      },
      {
        name: "currentEpoch",
        inputs: [],
        outputs: [{ name: "epoch", type: "uint256" }],
      },
    ],
  },
];

// ─── ABI interface map for decoding ──────────────────────────────────

const ALL_ABIS = [
  ...ERC20_ABI,
  ...OPERATOR_REGISTRY_ABI,
  ...SUBNET_REWARDS_ABI,
];

function getContractName(address: string): string | null {
  const lower = address.toLowerCase();
  if (lower === ZEROP_TOKEN_ADDRESS.toLowerCase()) return "ZEROP Token";
  if (lower === OPERATOR_REGISTRY_ADDRESS.toLowerCase()) return "Operator Registry";
  if (lower === SUBNET_REWARDS_ADDRESS.toLowerCase()) return "Subnet Rewards";
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const truncate = (s: string, len = 10) =>
  s.length <= len * 2 + 2 ? s : `${s.slice(0, len)}...${s.slice(-len)}`;

const truncateShort = (s: string) => truncate(s, 6);

const formatTimestamp = (ts: number) => {
  const d = new Date(ts * 1000);
  return d.toLocaleString();
};

const timeAgo = (ts: number) => {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const formatGwei = (wei: string) => {
  try {
    return parseFloat(ethers.formatUnits(wei, "gwei")).toFixed(2) + " Gwei";
  } catch {
    return "0 Gwei";
  }
};

const formatZeropNative = (wei: string) => {
  try {
    const val = parseFloat(ethers.formatEther(wei));
    if (val === 0) return "0 ZEROP";
    if (val < 0.0001) return "< 0.0001 ZEROP";
    return val.toFixed(6) + " ZEROP";
  } catch {
    return "0 ZEROP";
  }
};

const formatZeropDisplay = (wei: string) => {
  try {
    return parseFloat(ethers.formatUnits(wei, 18)).toFixed(4) + " ZEROP";
  } catch {
    return "0 ZEROP";
  }
};

const copyToClipboard = async (text: string) => {
  if (Platform.OS === "web") {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  }
};

// ─── Main Component ──────────────────────────────────────────────────

export default function ExplorerScreen() {
  const router = useRouter();
  const { theme: colors } = useTheme();
  const styles = createStyles(colors);

  const providerRef = useRef<ethers.JsonRpcProvider | null>(null);
  const getProvider = useCallback(() => {
    if (!providerRef.current) {
      providerRef.current = getSubnetProvider();
    }
    return providerRef.current;
  }, []);

  // ── Navigation state ──
  const [view, setView] = useState<ExplorerView>("overview");
  const [navStack, setNavStack] = useState<ExplorerView[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Data state ──
  const [latestBlockNum, setLatestBlockNum] = useState<number>(0);
  const [gasPrice, setGasPrice] = useState<string>("0");
  const [latestBlocks, setLatestBlocks] = useState<BlockSummary[]>([]);
  const [latestTxs, setLatestTxs] = useState<TxSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Subnet-specific stats ──
  const [subnetStats, setSubnetStats] = useState<{
    currentEpoch: number;
    totalRewards: string;
    totalStaked: string;
    zeropSupply: string;
    mintPrice: string;
    minStake: string;
  } | null>(null);

  // ── Block list state ──
  const [blockList, setBlockList] = useState<BlockSummary[]>([]);
  const [blockPage, setBlockPage] = useState(0);
  const [blockListLoading, setBlockListLoading] = useState(false);

  // ── Block detail state ──
  const [selectedBlock, setSelectedBlock] = useState<BlockDetail | null>(null);
  const [blockDetailLoading, setBlockDetailLoading] = useState(false);

  // ── Transaction list state ──
  const [txList, setTxList] = useState<TxSummary[]>([]);
  const [txListLoading, setTxListLoading] = useState(false);

  // ── Transaction detail state ──
  const [selectedTx, setSelectedTx] = useState<TxDetail | null>(null);
  const [txDetailLoading, setTxDetailLoading] = useState(false);

  // ── Contract detail state ──
  const [selectedContract, setSelectedContract] = useState<ContractInfo | null>(null);
  const [readInputs, setReadInputs] = useState<Record<string, Record<string, string>>>({});
  const [readResults, setReadResults] = useState<Record<string, ReadFunctionResult>>({});

  // ── Address state ──
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [addressNative, setAddressNative] = useState<string>("0");
  const [addressZerop, setAddressZerop] = useState<string>("0");
  const [addressTxs, setAddressTxs] = useState<TxSummary[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);

  // ─── Navigation helpers ────────────────────────────────────────────

  const navigateTo = useCallback(
    (newView: ExplorerView) => {
      setNavStack((prev) => [...prev, view]);
      setView(newView);
    },
    [view]
  );

  const goBack = useCallback(() => {
    if (navStack.length > 0) {
      const prev = navStack[navStack.length - 1];
      setNavStack((s) => s.slice(0, -1));
      setView(prev);
    } else {
      router.back();
    }
  }, [navStack, router]);

  // ─── Data fetching ─────────────────────────────────────────────────

  const fetchBlockSummary = useCallback(
    async (blockNum: number): Promise<BlockSummary | null> => {
      try {
        const block = await getProvider().getBlock(blockNum);
        if (!block) return null;
        return {
          number: block.number,
          hash: block.hash || "",
          timestamp: block.timestamp,
          transactions: block.transactions.length,
          gasUsed: block.gasUsed.toString(),
          gasLimit: block.gasLimit.toString(),
          miner: block.miner,
          baseFeePerGas: block.baseFeePerGas?.toString() || null,
        };
      } catch {
        return null;
      }
    },
    [getProvider]
  );

  // Set of our contract addresses (lowercase) for filtering
  const CONTRACT_ADDRS_SET = new Set([
    ZEROP_TOKEN_ADDRESS.toLowerCase(),
    OPERATOR_REGISTRY_ADDRESS.toLowerCase(),
    SUBNET_REWARDS_ADDRESS.toLowerCase(),
  ]);

  const fetchOverview = useCallback(async () => {
    try {
      const provider = getProvider();
      const [blockNum, gp] = await Promise.all([
        provider.getBlockNumber(),
        provider.getFeeData(),
      ]);
      setLatestBlockNum(blockNum);
      setGasPrice(gp.gasPrice?.toString() || "0");

      // Fetch subnet contract stats in parallel
      try {
        const rewardsContract = new ethers.Contract(SUBNET_REWARDS_ADDRESS, SUBNET_REWARDS_ABI, provider);
        const registryContract = new ethers.Contract(OPERATOR_REGISTRY_ADDRESS, OPERATOR_REGISTRY_ABI, provider);

        const [epochStats, minStake] = await Promise.all([
          rewardsContract.getGlobalEpochStats().catch(() => null),
          registryContract.MIN_STAKE_AMOUNT().catch(() => 0n),
        ]);

        setSubnetStats({
          currentEpoch: epochStats ? Number(epochStats[0]) : 0,
          totalRewards: epochStats ? epochStats[1].toString() : "0",
          totalStaked: epochStats ? epochStats[2].toString() : "0",
          zeropSupply: "0",
          mintPrice: "0",
          minStake: minStake.toString(),
        });
      } catch (err) {
        console.error("[Explorer] subnet stats error:", err);
      }

      // Fetch last 3 blocks (reduced from 5)
      const blockPromises = [];
      for (let i = 0; i < 3; i++) {
        if (blockNum - i >= 0) {
          blockPromises.push(fetchBlockSummary(blockNum - i));
        }
      }
      const blocks = (await Promise.all(blockPromises)).filter(
        (b): b is BlockSummary => b !== null
      );
      setLatestBlocks(blocks);

      // Fetch txs from recent blocks — prioritize ones involving our contracts
      const txs: TxSummary[] = [];
      const contractTxs: TxSummary[] = [];
      for (let bi = 0; bi < Math.min(blocks.length, 3); bi++) {
        const block = blocks[bi];
        const fullBlock = await provider.getBlock(block.number, true);
        if (!fullBlock) continue;
        for (const txHash of fullBlock.transactions.slice(0, 20)) {
          try {
            const tx = await provider.getTransaction(txHash as string);
            if (!tx) continue;
            const receipt = await provider.getTransactionReceipt(txHash as string);
            const summary: TxSummary = {
              hash: tx.hash,
              from: tx.from,
              to: tx.to,
              value: tx.value.toString(),
              blockNumber: block.number,
              timestamp: block.timestamp,
              gasUsed: receipt?.gasUsed?.toString() || "0",
              status: receipt?.status === 1,
              methodId: tx.data.slice(0, 10),
            };
            // Check if this tx involves our contracts
            const isSubnetTx =
              (tx.to && CONTRACT_ADDRS_SET.has(tx.to.toLowerCase())) ||
              CONTRACT_ADDRS_SET.has(tx.from.toLowerCase());
            if (isSubnetTx) {
              contractTxs.push(summary);
            } else if (txs.length < 5) {
              txs.push(summary);
            }
          } catch {
            continue;
          }
        }
      }
      // Show contract txs first, then fill with regular txs
      setLatestTxs([...contractTxs.slice(0, 8), ...txs].slice(0, 8));
    } catch (err) {
      console.error("[Explorer] fetchOverview error:", err);
    }
  }, [getProvider, fetchBlockSummary]);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    fetchOverview().finally(() => setIsLoading(false));
  }, [fetchOverview]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchOverview();
    setIsRefreshing(false);
  };

  // ─── Block list ────────────────────────────────────────────────────

  const BLOCKS_PER_PAGE = 15;

  const fetchBlockList = useCallback(
    async (page: number) => {
      setBlockListLoading(true);
      try {
        const startBlock = latestBlockNum - page * BLOCKS_PER_PAGE;
        const promises = [];
        for (let i = 0; i < BLOCKS_PER_PAGE; i++) {
          const num = startBlock - i;
          if (num >= 0) promises.push(fetchBlockSummary(num));
        }
        const blocks = (await Promise.all(promises)).filter(
          (b): b is BlockSummary => b !== null
        );
        setBlockList(blocks);
      } catch (err) {
        console.error("[Explorer] fetchBlockList error:", err);
      } finally {
        setBlockListLoading(false);
      }
    },
    [latestBlockNum, fetchBlockSummary]
  );

  useEffect(() => {
    if (view === "blocks") {
      fetchBlockList(blockPage);
    }
  }, [view, blockPage, fetchBlockList]);

  // ─── Block detail ──────────────────────────────────────────────────

  const openBlockDetail = useCallback(
    async (blockNum: number) => {
      setBlockDetailLoading(true);
      navigateTo("block-detail");
      try {
        const block = await getProvider().getBlock(blockNum, true);
        if (block) {
          setSelectedBlock({
            number: block.number,
            hash: block.hash || "",
            timestamp: block.timestamp,
            transactions: block.transactions.length,
            gasUsed: block.gasUsed.toString(),
            gasLimit: block.gasLimit.toString(),
            miner: block.miner,
            baseFeePerGas: block.baseFeePerGas?.toString() || null,
            parentHash: block.parentHash,
            nonce: block.nonce,
            extraData: block.extraData,
            size: 0, // Not available directly from ethers v6
            stateRoot: block.stateRoot || "",
            transactionsRoot: "",
            receiptsRoot: "",
            logsBloom: "",
            txHashes: block.transactions.slice(0, 50) as string[],
          });
        }
      } catch (err) {
        console.error("[Explorer] openBlockDetail error:", err);
      } finally {
        setBlockDetailLoading(false);
      }
    },
    [getProvider, navigateTo]
  );

  // ─── Transaction list ──────────────────────────────────────────────

  const fetchTxList = useCallback(async () => {
    setTxListLoading(true);
    try {
      const provider = getProvider();
      const blockNum = await provider.getBlockNumber();
      const txs: TxSummary[] = [];

      // Scan last 10 blocks for transactions
      for (let i = 0; i < 10 && txs.length < 30; i++) {
        const num = blockNum - i;
        if (num < 0) break;
        const block = await provider.getBlock(num, true);
        if (!block) continue;

        for (const txHash of block.transactions) {
          try {
            const tx = await provider.getTransaction(txHash as string);
            if (!tx) continue;
            const receipt = await provider.getTransactionReceipt(txHash as string);
            txs.push({
              hash: tx.hash,
              from: tx.from,
              to: tx.to,
              value: tx.value.toString(),
              blockNumber: num,
              timestamp: block.timestamp,
              gasUsed: receipt?.gasUsed?.toString() || "0",
              status: receipt?.status === 1,
              methodId: tx.data.slice(0, 10),
            });
            if (txs.length >= 30) break;
          } catch {
            continue;
          }
        }
      }
      setTxList(txs);
    } catch (err) {
      console.error("[Explorer] fetchTxList error:", err);
    } finally {
      setTxListLoading(false);
    }
  }, [getProvider]);

  useEffect(() => {
    if (view === "transactions") {
      fetchTxList();
    }
  }, [view, fetchTxList]);

  // ─── Transaction detail ────────────────────────────────────────────

  const tryDecodeInput = (input: string, _to: string | null): DecodedData | null => {
    if (!input || input === "0x" || input.length < 10) return null;
    try {
      const iface = new ethers.Interface(ALL_ABIS);
      const parsed = iface.parseTransaction({ data: input, value: 0n });
      if (parsed) {
        const args = parsed.fragment.inputs.map((inp, idx) => ({
          name: inp.name,
          value: String(parsed.args[idx]),
        }));
        return { name: parsed.name, args };
      }
    } catch {}
    return null;
  };

  const tryDecodeLog = (log: ethers.Log): DecodedData | null => {
    try {
      const iface = new ethers.Interface(ALL_ABIS);
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed) {
        const args = parsed.fragment.inputs.map((inp, idx) => ({
          name: inp.name,
          value: String(parsed.args[idx]),
        }));
        return { name: parsed.name, args };
      }
    } catch {}
    return null;
  };

  const openTxDetail = useCallback(
    async (txHash: string) => {
      setTxDetailLoading(true);
      navigateTo("tx-detail");
      try {
        const provider = getProvider();
        const [tx, receipt] = await Promise.all([
          provider.getTransaction(txHash),
          provider.getTransactionReceipt(txHash),
        ]);
        if (!tx) return;

        const block = await provider.getBlock(tx.blockNumber || 0);
        const gasPrice = tx.gasPrice?.toString() || "0";
        const gasUsed = receipt?.gasUsed?.toString() || "0";
        const fee = (
          BigInt(gasPrice) * BigInt(gasUsed)
        ).toString();

        const logs: LogEntry[] =
          receipt?.logs.map((log, idx) => ({
            address: log.address,
            topics: log.topics as string[],
            data: log.data,
            logIndex: idx,
            decoded: tryDecodeLog(log),
          })) || [];

        setSelectedTx({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value.toString(),
          blockNumber: tx.blockNumber || 0,
          timestamp: block?.timestamp || 0,
          gasUsed,
          status: receipt?.status === 1,
          methodId: tx.data.slice(0, 10),
          gasPrice,
          gasLimit: tx.gasLimit.toString(),
          nonce: tx.nonce,
          transactionIndex: receipt?.index || 0,
          input: tx.data,
          fee,
          logs,
          decodedInput: tryDecodeInput(tx.data, tx.to),
        });
      } catch (err) {
        console.error("[Explorer] openTxDetail error:", err);
      } finally {
        setTxDetailLoading(false);
      }
    },
    [getProvider, navigateTo]
  );

  // ─── Contract read ─────────────────────────────────────────────────

  const openContractDetail = useCallback(
    (contract: ContractInfo) => {
      setSelectedContract(contract);
      setReadInputs({});
      setReadResults({});
      navigateTo("contract-detail");
    },
    [navigateTo]
  );

  const executeRead = useCallback(
    async (contractInfo: ContractInfo, fnName: string) => {
      const fn = contractInfo.readFunctions.find((f) => f.name === fnName);
      if (!fn) return;

      // Validate required inputs
      for (const inp of fn.inputs) {
        const val = (readInputs[fnName]?.[inp.name] || "").trim();
        if (!val) {
          setReadResults((prev) => ({
            ...prev,
            [fnName]: {
              name: fnName,
              result: null,
              error: `Missing required input: ${inp.name} (${inp.type})`,
              loading: false,
            },
          }));
          return;
        }
      }

      setReadResults((prev) => ({
        ...prev,
        [fnName]: { name: fnName, result: null, error: null, loading: true },
      }));
      try {
        const provider = getProvider();
        const contract = new ethers.Contract(
          contractInfo.address,
          contractInfo.abi,
          provider
        );

        const args = fn.inputs.map((inp) => {
          const val = (readInputs[fnName]?.[inp.name] || "").trim();
          return val;
        });

        const result = await contract[fnName](...args);
        let resultStr: string;

        if (fn.outputs.length > 1) {
          // Tuple result — ethers v6 Result is indexable
          resultStr = fn.outputs
            .map((out, i) => {
              const outputName = out.name || `[${i}]`;
              const val = result[i];
              // Format bigints nicely
              if (typeof val === "bigint") {
                const formatted = ethers.formatUnits(val, 18);
                return `${outputName}: ${val.toString()} (${parseFloat(formatted).toFixed(4)} formatted)`;
              }
              if (Array.isArray(val)) {
                return `${outputName}: [${val.join(", ")}]`;
              }
              return `${outputName}: ${String(val)}`;
            })
            .join("\n");
        } else {
          // Single value
          if (typeof result === "bigint") {
            const formatted = ethers.formatUnits(result, 18);
            resultStr = `${result.toString()} (${parseFloat(formatted).toFixed(4)} formatted)`;
          } else if (Array.isArray(result)) {
            resultStr = `[${result.join(", ")}]`;
          } else {
            resultStr = String(result);
          }
        }

        setReadResults((prev) => ({
          ...prev,
          [fnName]: { name: fnName, result: resultStr, error: null, loading: false },
        }));
      } catch (err: any) {
        const msg = err?.reason || err?.shortMessage || err?.message || "Contract call failed";
        setReadResults((prev) => ({
          ...prev,
          [fnName]: {
            name: fnName,
            result: null,
            error: msg,
            loading: false,
          },
        }));
      }
    },
    [getProvider, readInputs]
  );

  // ─── Address detail ────────────────────────────────────────────────

  const openAddress = useCallback(
    async (address: string) => {
      setSelectedAddress(address);
      setAddressLoading(true);
      setAddressTxs([]);
      navigateTo("address");
      try {
        const provider = getProvider();
        const [avaxBal, zeropBal] = await Promise.all([
          provider.getBalance(address),
          new ethers.Contract(ZEROP_TOKEN_ADDRESS, ERC20_ABI, provider).balanceOf(
            address
          ),
        ]);
        setAddressNative(avaxBal.toString());
        setAddressZerop(zeropBal.toString());

        // Scan recent blocks for txs involving this address
        const blockNum = await provider.getBlockNumber();
        const txs: TxSummary[] = [];
        for (let i = 0; i < 20 && txs.length < 15; i++) {
          const num = blockNum - i;
          if (num < 0) break;
          const block = await provider.getBlock(num, true);
          if (!block) continue;
          for (const txHash of block.transactions) {
            try {
              const tx = await provider.getTransaction(txHash as string);
              if (!tx) continue;
              if (
                tx.from.toLowerCase() === address.toLowerCase() ||
                tx.to?.toLowerCase() === address.toLowerCase()
              ) {
                const receipt = await provider.getTransactionReceipt(txHash as string);
                txs.push({
                  hash: tx.hash,
                  from: tx.from,
                  to: tx.to,
                  value: tx.value.toString(),
                  blockNumber: num,
                  timestamp: block.timestamp,
                  gasUsed: receipt?.gasUsed?.toString() || "0",
                  status: receipt?.status === 1,
                  methodId: tx.data.slice(0, 10),
                });
              }
            } catch {
              continue;
            }
          }
        }
        setAddressTxs(txs);
      } catch (err) {
        console.error("[Explorer] openAddress error:", err);
      } finally {
        setAddressLoading(false);
      }
    },
    [getProvider, navigateTo]
  );

  // ─── Search handler ────────────────────────────────────────────────

  const handleSearch = useCallback(() => {
    const q = searchQuery.trim();
    if (!q) return;

    // Block number
    if (/^\d+$/.test(q)) {
      openBlockDetail(parseInt(q, 10));
      return;
    }

    // Transaction hash (0x + 64 hex)
    if (/^0x[0-9a-fA-F]{64}$/.test(q)) {
      openTxDetail(q);
      return;
    }

    // Address (0x + 40 hex)
    if (/^0x[0-9a-fA-F]{40}$/.test(q)) {
      openAddress(q);
      return;
    }

    // Try as block hash
    if (/^0x[0-9a-fA-F]{64}$/.test(q)) {
      openTxDetail(q); // fallback
    }
  }, [searchQuery, openBlockDetail, openTxDetail, openAddress]);

  // (No external block explorer for custom subnet)

  // ─── RENDER: Sub-components ────────────────────────────────────────

  const renderTestnetBadge = () => (
    <View style={styles.testnetBadge}>
      <AlertTriangle size={10} color="#FF9800" />
      <Text style={styles.testnetBadgeText}>TESTNET</Text>
    </View>
  );

  const renderDataRow = (
    label: string,
    value: string,
    options?: {
      mono?: boolean;
      copyable?: boolean;
      onPress?: () => void;
      linkColor?: string;
    }
  ) => (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <View style={styles.dataValueRow}>
        {options?.onPress ? (
          <TouchableOpacity onPress={options.onPress} style={{ flex: 1 }}>
            <Text
              style={[
                styles.dataValue,
                options?.mono && styles.mono,
                { color: options?.linkColor || "#60A5FA" },
              ]}
              numberOfLines={2}
            >
              {value}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text
            style={[styles.dataValue, options?.mono && styles.mono]}
            numberOfLines={2}
            selectable
          >
            {value}
          </Text>
        )}
        {options?.copyable && (
          <TouchableOpacity
            onPress={() => copyToClipboard(value)}
            style={styles.copyBtn}
          >
            <Copy size={12} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderNavTabs = () => (
    <View style={styles.navTabs}>
      {(
        [
          { key: "overview", icon: Home, label: "Overview" },
          { key: "blocks", icon: Database, label: "Blocks" },
          { key: "transactions", icon: ArrowRightLeft, label: "Txns" },
          { key: "contracts", icon: FileCode, label: "Contracts" },
        ] as const
      ).map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.navTab, view === tab.key && styles.navTabActive]}
          onPress={() => {
            setNavStack([]);
            setView(tab.key);
          }}
        >
          <tab.icon
            size={14}
            color={view === tab.key ? "#60A5FA" : colors.textSecondary}
          />
          <Text
            style={[
              styles.navTabText,
              view === tab.key && { color: "#60A5FA" },
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ─── RENDER: Overview ──────────────────────────────────────────────

  const renderOverview = () => (
    <>
      {/* Subnet Stats (primary focus) */}
      {subnetStats && (
        <View style={styles.subnetStatsCard}>
          <View style={styles.subnetStatsHeader}>
            <Activity size={16} color="#00FF41" />
            <Text style={styles.subnetStatsTitle}>ZeroPrompt Subnet</Text>
            <View style={styles.testnetBadge}>
              <AlertTriangle size={8} color="#FF9800" />
              <Text style={styles.testnetBadgeText}>SUBNET</Text>
            </View>
          </View>
          <View style={styles.subnetStatsGrid}>
            <View style={styles.subnetStat}>
              <Text style={styles.subnetStatValue}>
                #{subnetStats.currentEpoch}
              </Text>
              <Text style={styles.subnetStatLabel}>Current Epoch</Text>
            </View>
            <View style={styles.subnetStatDivider} />
            <View style={styles.subnetStat}>
              <Text style={styles.subnetStatValue}>
                {parseFloat(ethers.formatUnits(subnetStats.totalStaked, 18)).toFixed(0)}
              </Text>
              <Text style={styles.subnetStatLabel}>ZEROP Staked</Text>
            </View>
            <View style={styles.subnetStatDivider} />
            <View style={styles.subnetStat}>
              <Text style={styles.subnetStatValue}>
                {parseFloat(ethers.formatUnits(subnetStats.minStake, 18)).toFixed(0)}
              </Text>
              <Text style={styles.subnetStatLabel}>Min Stake</Text>
            </View>
          </View>
          <View style={[styles.subnetStatsRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.subnetStatsRowLabel}>Epoch Rewards Pool</Text>
            <Text style={styles.subnetStatsRowValue}>
              {parseFloat(ethers.formatUnits(subnetStats.totalRewards, 18)).toFixed(2)} ZEROP
            </Text>
          </View>
        </View>
      )}

      {/* RPC Connection Status */}
      <View style={styles.subnetStatsCard}>
        <View style={styles.subnetStatsHeader}>
          <CheckCircle size={16} color="#4CAF50" />
          <Text style={styles.subnetStatsTitle}>RPC Connection</Text>
          <View style={[styles.testnetBadge, { backgroundColor: "#4CAF5020" }]}>
            <CheckCircle size={8} color="#4CAF50" />
            <Text style={[styles.testnetBadgeText, { color: "#4CAF50" }]}>CONNECTED</Text>
          </View>
        </View>
        <View style={styles.subnetStatsRow}>
          <Text style={styles.subnetStatsRowLabel}>RPC Endpoint</Text>
          <TouchableOpacity onPress={() => copyToClipboard(SUBNET_RPC)} style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 }}>
            <Text style={[styles.subnetStatsRowValue, { fontSize: 10, color: "#60A5FA" }]} numberOfLines={1}>
              {SUBNET_RPC.length > 50 ? SUBNET_RPC.slice(0, 50) + "..." : SUBNET_RPC}
            </Text>
            <Copy size={10} color="#60A5FA" />
          </TouchableOpacity>
        </View>
        <View style={styles.subnetStatsRow}>
          <Text style={styles.subnetStatsRowLabel}>Chain ID</Text>
          <Text style={styles.subnetStatsRowValue}>{SUBNET_CHAIN_ID} (0x{SUBNET_CHAIN_ID.toString(16)})</Text>
        </View>
        <View style={styles.subnetStatsRow}>
          <Text style={styles.subnetStatsRowLabel}>Network</Text>
          <Text style={styles.subnetStatsRowValue}>ZeroPrompt Subnet (Avalanche L1)</Text>
        </View>
        <View style={styles.subnetStatsRow}>
          <Text style={styles.subnetStatsRowLabel}>Native Token</Text>
          <Text style={styles.subnetStatsRowValue}>ZEROP (18 decimals)</Text>
        </View>
        <View style={[styles.subnetStatsRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.subnetStatsRowLabel}>Latest Block</Text>
          <Text style={styles.subnetStatsRowValue}>#{latestBlockNum.toLocaleString()}</Text>
        </View>
      </View>

      {/* Chain Info */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Layers size={16} color="#60A5FA" />
          <Text style={styles.statLabel}>Latest Block</Text>
          <Text style={styles.statValue}>
            {latestBlockNum.toLocaleString()}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Fuel size={16} color="#FF9800" />
          <Text style={styles.statLabel}>Gas Price</Text>
          <Text style={styles.statValue}>{formatGwei(gasPrice)}</Text>
        </View>
        <View style={styles.statCard}>
          <Activity size={16} color="#4CAF50" />
          <Text style={styles.statLabel}>Chain ID</Text>
          <Text style={styles.statValue}>{SUBNET_CHAIN_ID}</Text>
        </View>
        <View style={styles.statCard}>
          <Database size={16} color="#2196F3" />
          <Text style={styles.statLabel}>Contracts</Text>
          <Text style={styles.statValue}>3</Text>
        </View>
      </View>

      {/* Latest Blocks */}
      <View style={styles.listSection}>
        <View style={styles.listHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Database size={16} color={colors.primary} />
            <Text style={styles.listTitle}>Recent Chain Blocks</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setNavStack([]);
              setView("blocks");
            }}
          >
            <Text style={styles.viewAllText}>Browse All</Text>
          </TouchableOpacity>
        </View>
        {latestBlocks.map((block) => (
          <TouchableOpacity
            key={block.number}
            style={styles.listItem}
            onPress={() => openBlockDetail(block.number)}
          >
            <View style={styles.listItemLeft}>
              <View style={styles.blockIcon}>
                <Database size={14} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.listItemPrimary}>
                  Block #{block.number.toLocaleString()}
                </Text>
                <Text style={styles.listItemSecondary}>
                  {timeAgo(block.timestamp)} | {block.transactions} txns
                </Text>
              </View>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.listItemMeta}>
                Gas: {((parseInt(block.gasUsed) / parseInt(block.gasLimit)) * 100).toFixed(1)}%
              </Text>
              <Text style={[styles.listItemSecondary, { fontSize: 10 }]}>
                {truncateShort(block.miner)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Latest Transactions */}
      <View style={styles.listSection}>
        <View style={styles.listHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ArrowRightLeft size={16} color={colors.primary} />
            <Text style={styles.listTitle}>Recent Transactions</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setNavStack([]);
              setView("transactions");
            }}
          >
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>
        {latestTxs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No transactions in recent blocks</Text>
          </View>
        ) : (
          latestTxs.map((tx) => (
            <TouchableOpacity
              key={tx.hash}
              style={styles.listItem}
              onPress={() => openTxDetail(tx.hash)}
            >
              <View style={styles.listItemLeft}>
                <View
                  style={[
                    styles.txIcon,
                    {
                      backgroundColor: tx.status
                        ? colors.success + "20"
                        : colors.error + "20",
                    },
                  ]}
                >
                  {tx.status ? (
                    <CheckCircle size={12} color={colors.success} />
                  ) : (
                    <XCircle size={12} color={colors.error} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.listItemPrimary, styles.mono]}>
                    {truncateShort(tx.hash)}
                  </Text>
                  <Text style={styles.listItemSecondary}>
                    From: {truncateShort(tx.from)}
                    {tx.to ? ` → ${truncateShort(tx.to)}` : " (Create)"}
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.listItemMeta}>{formatZeropNative(tx.value)}</Text>
                <Text style={[styles.listItemSecondary, { fontSize: 10 }]}>
                  {timeAgo(tx.timestamp)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Subnet Contracts Quick Links */}
      <View style={styles.listSection}>
        <View style={styles.listHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <FileCode size={16} color={colors.primary} />
            <Text style={styles.listTitle}>Subnet Contracts</Text>
          </View>
        </View>
        {CONTRACTS.map((c) => (
          <TouchableOpacity
            key={c.address}
            style={styles.listItem}
            onPress={() => openContractDetail(c)}
          >
            <View style={styles.listItemLeft}>
              <View style={[styles.contractDot, { backgroundColor: c.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.listItemPrimary}>{c.name}</Text>
                <Text style={[styles.listItemSecondary, styles.mono]}>
                  {truncateShort(c.address)}
                </Text>
              </View>
            </View>
            <View style={styles.contractTypeBadge}>
              <Text style={styles.contractTypeText}>{c.type}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  // ─── RENDER: Blocks list ───────────────────────────────────────────

  const renderBlocks = () => (
    <>
      <View style={styles.listSection}>
        <Text style={styles.pageTitle}>
          Blocks (Page {blockPage + 1})
        </Text>
        {blockListLoading ? (
          <View style={styles.loadingInline}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          blockList.map((block) => (
            <TouchableOpacity
              key={block.number}
              style={styles.listItem}
              onPress={() => openBlockDetail(block.number)}
            >
              <View style={styles.listItemLeft}>
                <View style={styles.blockIcon}>
                  <Database size={14} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.listItemPrimary}>
                    #{block.number.toLocaleString()}
                  </Text>
                  <Text style={styles.listItemSecondary}>
                    {timeAgo(block.timestamp)} | {block.transactions} txns
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.listItemSecondary, styles.mono, { fontSize: 10 }]}>
                  {truncateShort(block.hash)}
                </Text>
                <Text style={styles.listItemMeta}>
                  Gas: {((parseInt(block.gasUsed) / parseInt(block.gasLimit)) * 100).toFixed(1)}%
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
        {/* Pagination */}
        <View style={styles.pagination}>
          <TouchableOpacity
            style={[styles.pageBtn, blockPage === 0 && styles.pageBtnDisabled]}
            onPress={() => blockPage > 0 && setBlockPage(blockPage - 1)}
            disabled={blockPage === 0}
          >
            <ChevronLeft size={16} color={blockPage > 0 ? colors.primary : colors.textSecondary} />
            <Text
              style={[
                styles.pageBtnText,
                blockPage === 0 && { color: colors.textSecondary },
              ]}
            >
              Newer
            </Text>
          </TouchableOpacity>
          <Text style={styles.pageInfo}>
            {latestBlockNum - blockPage * BLOCKS_PER_PAGE} - {latestBlockNum - (blockPage + 1) * BLOCKS_PER_PAGE + 1}
          </Text>
          <TouchableOpacity
            style={styles.pageBtn}
            onPress={() => setBlockPage(blockPage + 1)}
          >
            <Text style={styles.pageBtnText}>Older</Text>
            <ChevronRight size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  // ─── RENDER: Block detail ──────────────────────────────────────────

  const renderBlockDetail = () => {
    if (blockDetailLoading || !selectedBlock) {
      return (
        <View style={styles.loadingInline}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading block...</Text>
        </View>
      );
    }
    const b = selectedBlock;
    return (
      <>
        <View style={styles.detailHeader}>
          <Database size={20} color={colors.primary} />
          <Text style={styles.detailTitle}>Block #{b.number.toLocaleString()}</Text>
          <TouchableOpacity onPress={() => copyToClipboard(b.hash)}>
            <Copy size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.detailCard}>
          {renderDataRow("Block Height", b.number.toLocaleString())}
          {renderDataRow("Timestamp", `${formatTimestamp(b.timestamp)} (${timeAgo(b.timestamp)})`)}
          {renderDataRow("Transactions", `${b.transactions} transactions`)}
          {renderDataRow("Block Hash", b.hash, {
            mono: true,
            copyable: true,
          })}
          {renderDataRow("Parent Hash", b.parentHash, {
            mono: true,
            copyable: true,
            onPress: () => openBlockDetail(b.number - 1),
          })}
          {renderDataRow(
            "Fee Recipient",
            b.miner,
            {
              mono: true,
              copyable: true,
              onPress: () => openAddress(b.miner),
            }
          )}
          {renderDataRow("Gas Used", `${parseInt(b.gasUsed).toLocaleString()} / ${parseInt(b.gasLimit).toLocaleString()} (${((parseInt(b.gasUsed) / parseInt(b.gasLimit)) * 100).toFixed(2)}%)`)}
          {b.baseFeePerGas &&
            renderDataRow("Base Fee", formatGwei(b.baseFeePerGas))}
          {renderDataRow("Nonce", b.nonce)}
          {b.stateRoot &&
            renderDataRow("State Root", b.stateRoot, {
              mono: true,
              copyable: true,
            })}
          {b.extraData &&
            b.extraData !== "0x" &&
            renderDataRow("Extra Data", b.extraData, { mono: true })}
        </View>

        {/* Block Transactions */}
        {b.txHashes.length > 0 && (
          <View style={styles.listSection}>
            <Text style={styles.sectionLabel}>
              Transactions ({b.txHashes.length})
            </Text>
            {b.txHashes.map((hash, idx) => (
              <TouchableOpacity
                key={hash}
                style={styles.listItem}
                onPress={() => openTxDetail(hash)}
              >
                <View style={styles.listItemLeft}>
                  <Text style={[styles.listItemSecondary, { width: 24 }]}>
                    {idx}
                  </Text>
                  <Text style={[styles.listItemPrimary, styles.mono, { flex: 1 }]}>
                    {truncate(hash, 16)}
                  </Text>
                </View>
                <ChevronRight size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </>
    );
  };

  // ─── RENDER: Transactions list ─────────────────────────────────────

  const renderTransactions = () => (
    <>
      <View style={styles.listSection}>
        <Text style={styles.pageTitle}>Recent Transactions</Text>
        {txListLoading ? (
          <View style={styles.loadingInline}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : txList.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No transactions found in recent blocks</Text>
          </View>
        ) : (
          txList.map((tx) => {
            const contractName = tx.to ? getContractName(tx.to) : null;
            return (
              <TouchableOpacity
                key={tx.hash}
                style={styles.listItem}
                onPress={() => openTxDetail(tx.hash)}
              >
                <View style={styles.listItemLeft}>
                  <View
                    style={[
                      styles.txIcon,
                      {
                        backgroundColor: tx.status
                          ? colors.success + "20"
                          : colors.error + "20",
                      },
                    ]}
                  >
                    {tx.status ? (
                      <CheckCircle size={12} color={colors.success} />
                    ) : (
                      <XCircle size={12} color={colors.error} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.listItemPrimary, styles.mono]}
                      numberOfLines={1}
                    >
                      {truncateShort(tx.hash)}
                    </Text>
                    <Text style={styles.listItemSecondary} numberOfLines={1}>
                      {truncateShort(tx.from)} → {tx.to ? truncateShort(tx.to) : "Create"}
                      {contractName ? ` (${contractName})` : ""}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.listItemMeta}>
                    {formatZeropNative(tx.value)}
                  </Text>
                  <Text style={[styles.listItemSecondary, { fontSize: 10 }]}>
                    Block {tx.blockNumber}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </>
  );

  // ─── RENDER: Transaction detail ────────────────────────────────────

  const renderTxDetail = () => {
    if (txDetailLoading || !selectedTx) {
      return (
        <View style={styles.loadingInline}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading transaction...</Text>
        </View>
      );
    }
    const tx = selectedTx;
    return (
      <>
        <View style={styles.detailHeader}>
          <ArrowRightLeft size={20} color={colors.primary} />
          <Text style={styles.detailTitle}>Transaction Details</Text>
          <TouchableOpacity onPress={() => copyToClipboard(tx.hash)}>
            <Copy size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.detailCard}>
          {/* Status badge */}
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Status</Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: tx.status
                    ? colors.success + "20"
                    : colors.error + "20",
                },
              ]}
            >
              {tx.status ? (
                <CheckCircle size={12} color={colors.success} />
              ) : (
                <XCircle size={12} color={colors.error} />
              )}
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: tx.status ? colors.success : colors.error,
                }}
              >
                {tx.status ? "Success" : "Failed"}
              </Text>
            </View>
          </View>

          {renderDataRow("Transaction Hash", tx.hash, {
            mono: true,
            copyable: true,
          })}
          {renderDataRow("Block", tx.blockNumber.toLocaleString(), {
            onPress: () => openBlockDetail(tx.blockNumber),
          })}
          {renderDataRow("Timestamp", `${formatTimestamp(tx.timestamp)} (${timeAgo(tx.timestamp)})`)}

          {renderDataRow("From", tx.from, {
            mono: true,
            copyable: true,
            onPress: () => openAddress(tx.from),
          })}
          {renderDataRow(
            "To",
            tx.to
              ? `${tx.to}${getContractName(tx.to) ? ` (${getContractName(tx.to)})` : ""}`
              : "Contract Creation",
            tx.to
              ? {
                  mono: true,
                  copyable: true,
                  onPress: () => openAddress(tx.to!),
                }
              : undefined
          )}

          {renderDataRow("Value", formatZeropNative(tx.value))}
          {renderDataRow("Transaction Fee", formatZeropNative(tx.fee))}
          {renderDataRow("Gas Price", formatGwei(tx.gasPrice))}
          {renderDataRow("Gas Limit & Usage", `${parseInt(tx.gasLimit).toLocaleString()} | ${parseInt(tx.gasUsed).toLocaleString()} (${((parseInt(tx.gasUsed) / parseInt(tx.gasLimit)) * 100).toFixed(2)}%)`)}
          {renderDataRow("Nonce", tx.nonce.toString())}
          {renderDataRow("Position in Block", tx.transactionIndex.toString())}
        </View>

        {/* Decoded Input */}
        {tx.decodedInput && (
          <View style={styles.listSection}>
            <Text style={styles.sectionLabel}>Decoded Input Data</Text>
            <View style={styles.decodedBox}>
              <Text style={styles.decodedFnName}>
                Function: {tx.decodedInput.name}
              </Text>
              {tx.decodedInput.args.map((arg, idx) => (
                <View key={idx} style={styles.decodedArg}>
                  <Text style={styles.decodedArgName}>{arg.name}</Text>
                  <Text style={[styles.decodedArgValue, styles.mono]} selectable>
                    {arg.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Raw Input Data */}
        {tx.input && tx.input !== "0x" && (
          <View style={styles.listSection}>
            <Text style={styles.sectionLabel}>Raw Input Data</Text>
            <View style={styles.rawDataBox}>
              <Text style={[styles.rawDataText, styles.mono]} selectable>
                {tx.input.length > 200
                  ? tx.input.slice(0, 200) + "..."
                  : tx.input}
              </Text>
            </View>
          </View>
        )}

        {/* Event Logs */}
        {tx.logs.length > 0 && (
          <View style={styles.listSection}>
            <Text style={styles.sectionLabel}>
              Event Logs ({tx.logs.length})
            </Text>
            {tx.logs.map((log, idx) => (
              <View key={idx} style={styles.logEntry}>
                <View style={styles.logHeader}>
                  <Text style={styles.logIndex}>#{log.logIndex}</Text>
                  <TouchableOpacity onPress={() => openAddress(log.address)}>
                    <Text style={[styles.logAddress, styles.mono]}>
                      {truncateShort(log.address)}
                      {getContractName(log.address)
                        ? ` (${getContractName(log.address)})`
                        : ""}
                    </Text>
                  </TouchableOpacity>
                </View>

                {log.decoded ? (
                  <View style={styles.decodedBox}>
                    <Text style={styles.decodedFnName}>
                      Event: {log.decoded.name}
                    </Text>
                    {log.decoded.args.map((arg, i) => (
                      <View key={i} style={styles.decodedArg}>
                        <Text style={styles.decodedArgName}>{arg.name}</Text>
                        <Text
                          style={[styles.decodedArgValue, styles.mono]}
                          numberOfLines={2}
                          selectable
                        >
                          {arg.value}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <>
                    <Text style={[styles.logTopicLabel, { marginTop: 6 }]}>
                      Topics:
                    </Text>
                    {log.topics.map((topic, ti) => (
                      <Text
                        key={ti}
                        style={[styles.logTopic, styles.mono]}
                        numberOfLines={1}
                        selectable
                      >
                        [{ti}] {truncate(topic, 20)}
                      </Text>
                    ))}
                    {log.data !== "0x" && (
                      <>
                        <Text style={styles.logTopicLabel}>Data:</Text>
                        <Text
                          style={[styles.logTopic, styles.mono]}
                          numberOfLines={2}
                          selectable
                        >
                          {log.data.length > 100
                            ? log.data.slice(0, 100) + "..."
                            : log.data}
                        </Text>
                      </>
                    )}
                  </>
                )}
              </View>
            ))}
          </View>
        )}
      </>
    );
  };

  // ─── RENDER: Contracts ─────────────────────────────────────────────

  const renderContracts = () => (
    <>
      <View style={styles.listSection}>
        <Text style={styles.pageTitle}>ZeroPrompt Subnet Contracts</Text>
        <Text style={styles.pageSubtitle}>
          Deployed on ZeroPrompt Subnet (Chain {SUBNET_CHAIN_ID})
        </Text>
        {CONTRACTS.map((c) => (
          <TouchableOpacity
            key={c.address}
            style={styles.contractCard}
            onPress={() => openContractDetail(c)}
          >
            <View style={styles.contractCardHeader}>
              <View style={[styles.contractDotLarge, { backgroundColor: c.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.contractCardName}>{c.name}</Text>
                <Text style={[styles.contractCardAddr, styles.mono]}>
                  {c.address}
                </Text>
              </View>
            </View>
            <View style={styles.contractCardFooter}>
              <View style={styles.contractTypeBadge}>
                <Text style={styles.contractTypeText}>{c.type}</Text>
              </View>
              <Text style={styles.contractFnCount}>
                {c.readFunctions.length} read function{c.readFunctions.length !== 1 ? "s" : ""}
              </Text>
              <TouchableOpacity
                onPress={() => openContractDetail(c)}
                style={styles.externalBtn}
              >
                <Eye size={12} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  // ─── RENDER: Contract detail (Read functions) ──────────────────────

  const renderContractDetail = () => {
    if (!selectedContract) return null;
    const c = selectedContract;
    return (
      <>
        <View style={styles.detailHeader}>
          <View style={[styles.contractDotLarge, { backgroundColor: c.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.detailTitle}>{c.name}</Text>
            <Text style={[styles.detailSubtitle, styles.mono]}>
              {truncate(c.address, 12)}
            </Text>
          </View>
          <TouchableOpacity onPress={() => copyToClipboard(c.address)}>
            <Copy size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.readContractHeader}>
          <Code size={16} color={colors.primary} />
          <Text style={styles.readContractTitle}>Read Contract</Text>
        </View>

        {c.readFunctions.map((fn) => {
          const result = readResults[fn.name];
          return (
            <View key={fn.name} style={styles.readFnCard}>
              <Text style={styles.readFnName}>{fn.name}</Text>

              {/* Inputs */}
              {fn.inputs.map((inp) => (
                <View key={inp.name} style={styles.readFnInput}>
                  <Text style={styles.readFnInputLabel}>
                    {inp.name} ({inp.type})
                  </Text>
                  <TextInput
                    style={styles.readFnInputField}
                    placeholder={`Enter ${inp.type}`}
                    placeholderTextColor={colors.textSecondary + "80"}
                    value={readInputs[fn.name]?.[inp.name] || ""}
                    onChangeText={(text) =>
                      setReadInputs((prev) => ({
                        ...prev,
                        [fn.name]: {
                          ...(prev[fn.name] || {}),
                          [inp.name]: text,
                        },
                      }))
                    }
                  />
                </View>
              ))}

              {/* Query Button */}
              <TouchableOpacity
                style={styles.queryBtn}
                onPress={() => executeRead(c, fn.name)}
                disabled={result?.loading}
              >
                {result?.loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Search size={14} color="#fff" />
                    <Text style={styles.queryBtnText}>Query</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Result */}
              {result && !result.loading && (
                <View
                  style={[
                    styles.readResult,
                    result.error
                      ? { borderLeftColor: colors.error }
                      : { borderLeftColor: colors.success },
                  ]}
                >
                  {result.error ? (
                    <Text style={[styles.readResultText, { color: colors.error }]}>
                      Error: {result.error}
                    </Text>
                  ) : (
                    <>
                      {fn.outputs.map((out, idx) => (
                        <Text key={idx} style={styles.readResultLabel}>
                          {out.name ? `${out.name} (${out.type})` : out.type}
                        </Text>
                      ))}
                      <Text style={[styles.readResultText, styles.mono]} selectable>
                        {result.result}
                      </Text>
                    </>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {/* Full Address Link */}
        <TouchableOpacity
          style={styles.fullAddressBtn}
          onPress={() => openAddress(c.address)}
        >
          <User size={14} color={colors.primary} />
          <Text style={styles.fullAddressBtnText}>View Address Details</Text>
        </TouchableOpacity>
      </>
    );
  };

  // ─── RENDER: Address detail ────────────────────────────────────────

  const renderAddress = () => {
    const contractName = getContractName(selectedAddress);
    return (
      <>
        <View style={styles.detailHeader}>
          <User size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.detailTitle}>
              {contractName || "Address"}
            </Text>
            <Text style={[styles.detailSubtitle, styles.mono]} selectable>
              {selectedAddress}
            </Text>
          </View>
          <TouchableOpacity onPress={() => copyToClipboard(selectedAddress)}>
            <Copy size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {addressLoading ? (
          <View style={styles.loadingInline}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading address...</Text>
          </View>
        ) : (
          <>
            {/* Balances */}
            <View style={styles.addressBalances}>
              <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>ZEROP Balance (Native)</Text>
                <Text style={styles.balanceValue}>
                  {formatZeropNative(addressNative)}
                </Text>
              </View>
              <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>ZEROP Balance</Text>
                <Text style={styles.balanceValue}>
                  {formatZeropDisplay(addressZerop)}
                </Text>
              </View>
            </View>

            {/* Contract indicator */}
            {contractName && (
              <TouchableOpacity
                style={styles.contractIndicator}
                onPress={() => {
                  const c = CONTRACTS.find(
                    (cc) =>
                      cc.address.toLowerCase() ===
                      selectedAddress.toLowerCase()
                  );
                  if (c) openContractDetail(c);
                }}
              >
                <FileCode size={14} color={colors.primary} />
                <Text style={styles.contractIndicatorText}>
                  This is a ZeroPrompt contract: {contractName}
                </Text>
                <ChevronRight size={14} color={colors.primary} />
              </TouchableOpacity>
            )}

            {/* Recent Transactions */}
            <View style={styles.listSection}>
              <Text style={styles.sectionLabel}>
                Recent Transactions ({addressTxs.length})
              </Text>
              {addressTxs.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    No recent transactions found
                  </Text>
                </View>
              ) : (
                addressTxs.map((tx) => {
                  const isIncoming =
                    tx.to?.toLowerCase() === selectedAddress.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={tx.hash}
                      style={styles.listItem}
                      onPress={() => openTxDetail(tx.hash)}
                    >
                      <View style={styles.listItemLeft}>
                        <View
                          style={[
                            styles.txIcon,
                            {
                              backgroundColor: isIncoming
                                ? colors.success + "20"
                                : "#FF9800" + "20",
                            },
                          ]}
                        >
                          {isIncoming ? (
                            <ArrowDownLeft size={12} color={colors.success} />
                          ) : (
                            <ArrowUpRight size={12} color="#FF9800" />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[styles.listItemPrimary, styles.mono]}
                            numberOfLines={1}
                          >
                            {truncateShort(tx.hash)}
                          </Text>
                          <Text
                            style={styles.listItemSecondary}
                            numberOfLines={1}
                          >
                            {isIncoming
                              ? `From: ${truncateShort(tx.from)}`
                              : `To: ${tx.to ? truncateShort(tx.to) : "Create"}`}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.listItemMeta}>
                          {formatZeropNative(tx.value)}
                        </Text>
                        <Text
                          style={[styles.listItemSecondary, { fontSize: 10 }]}
                        >
                          {timeAgo(tx.timestamp)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </>
        )}
      </>
    );
  };

  // ─── RENDER: Main ──────────────────────────────────────────────────

  const isDetailView = [
    "block-detail",
    "tx-detail",
    "contract-detail",
    "address",
  ].includes(view);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Subnet Explorer</Text>
          {renderTestnetBadge()}
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw
            size={18}
            color={isRefreshing ? colors.textSecondary : colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={16} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by Address / Tx Hash / Block #"
            placeholderTextColor={colors.textSecondary + "80"}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleSearch}>
              <ChevronRight size={18} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Navigation Tabs (only on list views) */}
      {!isDetailView && renderNavTabs()}

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {isLoading && view === "overview" ? (
          <View style={styles.loadingFull}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>
              Connecting to ZeroPrompt Subnet...
            </Text>
          </View>
        ) : (
          <>
            {view === "overview" && renderOverview()}
            {view === "blocks" && renderBlocks()}
            {view === "block-detail" && renderBlockDetail()}
            {view === "transactions" && renderTransactions()}
            {view === "tx-detail" && renderTxDetail()}
            {view === "contracts" && renderContracts()}
            {view === "contract-detail" && renderContractDetail()}
            {view === "address" && renderAddress()}
          </>
        )}

        {/* RPC info footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            RPC: {SUBNET_RPC}
          </Text>
          <Text style={styles.footerText}>
            Chain ID: {SUBNET_CHAIN_ID} | ZeroPrompt Subnet
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: Platform.OS === "web" ? 20 : 50,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: { padding: 8 },
    headerCenter: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    refreshBtn: { padding: 8 },
    testnetBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "#FF9800" + "20",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "#FF9800" + "40",
    },
    testnetBadgeText: {
      fontSize: 9,
      fontWeight: "700",
      color: "#FF9800",
      letterSpacing: 0.5,
    },
    // Search
    searchContainer: {
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      gap: 10,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.text,
      fontFamily: Platform.OS === "web" ? "monospace" : undefined,
    },
    // Nav Tabs
    navTabs: {
      flexDirection: "row",
      marginHorizontal: 16,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 4,
    },
    navTab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 10,
      borderRadius: 10,
    },
    navTabActive: {
      backgroundColor: "#2563EB" + "20",
    },
    navTabText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    // Subnet Stats
    subnetStatsCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: "#00FF41" + "30",
    },
    subnetStatsHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
    },
    subnetStatsTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
    },
    subnetStatsGrid: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
      marginBottom: 14,
    },
    subnetStat: {
      alignItems: "center",
    },
    subnetStatValue: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
    },
    subnetStatLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 4,
    },
    subnetStatDivider: {
      width: 1,
      height: 36,
      backgroundColor: colors.border,
    },
    subnetStatsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    subnetStatsRowLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    subnetStatsRowValue: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },
    // Stats Grid
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 20,
    },
    statCard: {
      flex: 1,
      minWidth: "45%",
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      gap: 6,
    },
    statLabel: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    statValue: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    // List sections
    listSection: {
      marginBottom: 20,
    },
    listHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    listTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
    },
    viewAllText: {
      fontSize: 13,
      fontWeight: "600",
      color: "#60A5FA",
    },
    listItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    listItemLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    listItemPrimary: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },
    listItemSecondary: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    listItemMeta: {
      fontSize: 11,
      fontWeight: "500",
      color: colors.text,
    },
    blockIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: "#2563EB" + "20",
      alignItems: "center",
      justifyContent: "center",
    },
    txIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    contractDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    contractDotLarge: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    contractTypeBadge: {
      backgroundColor: "#2563EB" + "20",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    contractTypeText: {
      fontSize: 10,
      fontWeight: "600",
      color: "#60A5FA",
    },
    // Loading
    loadingFull: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
      gap: 16,
    },
    loadingInline: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 30,
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: 24,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    // Page
    pageTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 4,
    },
    pageSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    // Pagination
    pagination: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 16,
      paddingHorizontal: 4,
    },
    pageBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pageBtnDisabled: {
      opacity: 0.4,
    },
    pageBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: "#60A5FA",
    },
    pageInfo: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    // Detail views
    detailHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 16,
    },
    detailTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
    },
    detailSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    detailCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      marginBottom: 16,
    },
    // Data rows
    dataRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    dataLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      minWidth: 100,
      flexShrink: 0,
    },
    dataValueRow: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      justifyContent: "flex-end",
      gap: 6,
    },
    dataValue: {
      fontSize: 12,
      color: colors.text,
      textAlign: "right",
    },
    copyBtn: {
      padding: 4,
    },
    mono: {
      fontFamily: Platform.OS === "web" ? "monospace" : undefined,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    sectionLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 10,
    },
    // Decoded data
    decodedBox: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: "#2563EB" + "30",
    },
    decodedFnName: {
      fontSize: 13,
      fontWeight: "700",
      color: "#60A5FA",
      marginBottom: 8,
    },
    decodedArg: {
      marginBottom: 6,
    },
    decodedArgName: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    decodedArgValue: {
      fontSize: 12,
      color: colors.text,
    },
    // Raw data
    rawDataBox: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rawDataText: {
      fontSize: 11,
      color: colors.textSecondary,
      lineHeight: 16,
    },
    // Log entries
    logEntry: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    logHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    logIndex: {
      fontSize: 12,
      fontWeight: "700",
      color: "#60A5FA",
    },
    logAddress: {
      fontSize: 12,
      color: "#60A5FA",
    },
    logTopicLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 2,
    },
    logTopic: {
      fontSize: 11,
      color: colors.textSecondary,
      lineHeight: 16,
      marginBottom: 2,
    },
    // Contract cards
    contractCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    contractCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 12,
    },
    contractCardName: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
    },
    contractCardAddr: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    contractCardFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    contractFnCount: {
      fontSize: 12,
      color: colors.textSecondary,
      flex: 1,
      marginLeft: 12,
    },
    externalBtn: {
      padding: 6,
      backgroundColor: colors.background,
      borderRadius: 6,
    },
    // Read contract
    readContractHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 14,
    },
    readContractTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
    },
    readFnCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    readFnName: {
      fontSize: 14,
      fontWeight: "700",
      color: "#60A5FA",
      marginBottom: 12,
      fontFamily: Platform.OS === "web" ? "monospace" : undefined,
    },
    readFnInput: {
      marginBottom: 10,
    },
    readFnInputLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    readFnInputField: {
      backgroundColor: colors.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
      color: colors.text,
      fontFamily: Platform.OS === "web" ? "monospace" : undefined,
    },
    queryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: "#2563EB",
      borderRadius: 10,
      paddingVertical: 12,
      marginBottom: 10,
    },
    queryBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#FFFFFF",
    },
    readResult: {
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      borderLeftWidth: 3,
    },
    readResultLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    readResultText: {
      fontSize: 13,
      color: colors.text,
      lineHeight: 20,
    },
    fullAddressBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: "#2563EB" + "20",
      borderRadius: 12,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: "#2563EB" + "50",
      marginTop: 8,
    },
    fullAddressBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#60A5FA",
    },
    // Address detail
    addressBalances: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 16,
    },
    balanceCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    balanceLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    balanceValue: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    contractIndicator: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#2563EB" + "18",
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: "#2563EB" + "40",
      marginBottom: 16,
    },
    contractIndicatorText: {
      fontSize: 13,
      color: "#60A5FA",
      flex: 1,
    },
    // Footer
    footer: {
      alignItems: "center",
      paddingTop: 20,
      gap: 4,
    },
    footerText: {
      fontSize: 10,
      color: colors.textSecondary + "80",
      fontFamily: Platform.OS === "web" ? "monospace" : undefined,
    },
  });
