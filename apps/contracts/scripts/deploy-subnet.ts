import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * ████████████████████████████████████████████████████████████████████████████████
 *   ZEROPROMPT SUBNET - DECENTRALIZED OLLAMA NETWORK
 * ████████████████████████████████████████████████████████████████████████████████
 *
 * Deploys the two core contracts for the ZeroPrompt decentralized Ollama subnet:
 * 1. OperatorRegistry - Operator registration, staking, and performance management
 * 2. SubnetRewards - Epoch-based rewards distribution
 */

interface SubnetDeployment {
  network: string;
  chainId: number;
  deployer: string;
  deploymentTime: string;
  contracts: {
    zeropToken: string;
    operatorRegistry: string;
    subnetRewards: string;
  };
  transactions: {
    zeropToken?: string;
    operatorRegistry: string;
    subnetRewards: string;
  };
}

async function main() {
  const networkName = network.name;
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log("\n");
  console.log("████████████████████████████████████████████████████████████████████████████████");
  console.log("  ZEROPROMPT SUBNET - DECENTRALIZED OLLAMA NETWORK");
  console.log("████████████████████████████████████████████████████████████████████████████████");
  console.log(`\n  Network: ${networkName}`);
  console.log(`  Chain ID: ${chainId}`);
  console.log("");

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance: ${ethers.formatEther(balance)} native tokens`);
  console.log("");

  // For testnets/local, deploy a mock ZEROP token
  // For mainnet, use the actual ZEROP token address
  let zeropTokenAddress: string;
  let zeropDeployTx: string | undefined;

  const isTestnet = networkName.includes("Fuji") ||
                    networkName.includes("Sepolia") ||
                    networkName.includes("hardhat") ||
                    networkName.includes("localhost") ||
                    networkName.includes("Testnet") ||
                    networkName.includes("zeropromptSubnet");

  // On the actual ZeroPrompt subnet, ZEROP is the native gas token (pre-allocated in genesis).
  // We deploy a WZEROP (Wrapped ZEROP) ERC-20 wrapper instead of MockERC20.
  const isNativeZerop = networkName.startsWith("zeropromptSubnet");

  if (isNativeZerop) {
    console.log("  [1/3] Deploying Wrapped ZEROP (WZEROP) Token...");
    console.log("        Native ZEROP is the gas token on this subnet.");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const wzeropToken = await MockERC20.deploy("Wrapped ZEROP", "WZEROP");
    await wzeropToken.waitForDeployment();
    zeropTokenAddress = await wzeropToken.getAddress();
    zeropDeployTx = wzeropToken.deploymentTransaction()?.hash;
    console.log(`        WZEROP deployed: ${zeropTokenAddress}`);

    // Mint some wrapped tokens for contract interactions (staking, etc.)
    await wzeropToken.mint(deployer.address, ethers.parseEther("1000000")); // 1M WZEROP
    console.log(`        Minted 1,000,000 WZEROP to deployer for testing`);
  } else if (isTestnet) {
    console.log("  [1/3] Deploying Mock ZEROP Token...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const zeropToken = await MockERC20.deploy("ZeroPrompt Token", "ZEROP");
    await zeropToken.waitForDeployment();
    zeropTokenAddress = await zeropToken.getAddress();
    zeropDeployTx = zeropToken.deploymentTransaction()?.hash;
    console.log(`        Mock ZEROP deployed: ${zeropTokenAddress}`);

    // Mint some tokens to deployer for testing
    await zeropToken.mint(deployer.address, ethers.parseEther("1000000")); // 1M ZEROP
    console.log(`        Minted 1,000,000 ZEROP to deployer for testing`);
  } else {
    // For mainnet, you would set the actual ZEROP token address here
    zeropTokenAddress = process.env.ZEROP_TOKEN_ADDRESS || "";
    if (!zeropTokenAddress) {
      throw new Error("ZEROP_TOKEN_ADDRESS environment variable required for mainnet deployment");
    }
    console.log(`  [1/3] Using existing ZEROP Token: ${zeropTokenAddress}`);
  }
  console.log("");

  // Deploy OperatorRegistry
  console.log("  [2/3] Deploying OperatorRegistry...");
  const OperatorRegistry = await ethers.getContractFactory("OperatorRegistry");
  const operatorRegistry = await OperatorRegistry.deploy(zeropTokenAddress);
  await operatorRegistry.waitForDeployment();
  const operatorRegistryAddress = await operatorRegistry.getAddress();
  const operatorRegistryTx = operatorRegistry.deploymentTransaction()?.hash;
  console.log(`        OperatorRegistry deployed: ${operatorRegistryAddress}`);
  console.log("");

  // Deploy SubnetRewards
  console.log("  [3/3] Deploying SubnetRewards...");
  const SubnetRewards = await ethers.getContractFactory("SubnetRewards");
  const subnetRewards = await SubnetRewards.deploy(zeropTokenAddress, operatorRegistryAddress);
  await subnetRewards.waitForDeployment();
  const subnetRewardsAddress = await subnetRewards.getAddress();
  const subnetRewardsTx = subnetRewards.deploymentTransaction()?.hash;
  console.log(`        SubnetRewards deployed: ${subnetRewardsAddress}`);
  console.log("");

  // Configure contracts
  console.log("  Configuring contracts...");

  // Set rewards contract in registry
  console.log("    - Setting rewards contract in OperatorRegistry...");
  await operatorRegistry.setRewardsContract(subnetRewardsAddress);

  // Set backend as authorized reporter (deployer for now)
  console.log("    - Setting deployer as authorized reporter...");
  await subnetRewards.setAuthorizedReporter(deployer.address, true);

  // Fund rewards pool for testnets / subnet
  if (isTestnet || isNativeZerop) {
    console.log("    - Funding rewards pool with 100,000 ZEROP...");
    const zeropToken = await ethers.getContractAt("MockERC20", zeropTokenAddress);
    const approveTx = await zeropToken.approve(subnetRewardsAddress, ethers.parseEther("100000"));
    await approveTx.wait();
    const fundTx = await subnetRewards.fundRewardsPool(ethers.parseEther("100000"));
    await fundTx.wait();
  }

  console.log("");
  console.log("████████████████████████████████████████████████████████████████████████████████");
  console.log("  DEPLOYMENT SUCCESSFUL!");
  console.log("████████████████████████████████████████████████████████████████████████████████");
  console.log("");
  console.log("  Contract Addresses:");
  console.log(`    ZEROP Token:       ${zeropTokenAddress}`);
  console.log(`    OperatorRegistry:  ${operatorRegistryAddress}`);
  console.log(`    SubnetRewards:     ${subnetRewardsAddress}`);
  console.log("");

  // Get contract configuration
  console.log("  Configuration:");
  const minStake = await operatorRegistry.MIN_STAKE_AMOUNT();
  const rewardPerRequest = await subnetRewards.REWARD_PER_REQUEST();

  console.log(`    - Min Stake: ${ethers.formatEther(minStake)} ZEROP`);
  console.log(`    - Reward/Request: ${ethers.formatEther(rewardPerRequest)} ZEROP`);
  console.log("");

  // Save deployment info
  const deploymentInfo: SubnetDeployment = {
    network: networkName,
    chainId: Number(chainId),
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    contracts: {
      zeropToken: zeropTokenAddress,
      operatorRegistry: operatorRegistryAddress,
      subnetRewards: subnetRewardsAddress,
    },
    transactions: {
      zeropToken: zeropDeployTx,
      operatorRegistry: operatorRegistryTx || "",
      subnetRewards: subnetRewardsTx || "",
    },
  };

  // Create deployments directory if needed
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save to file
  const filename = `subnet-${networkName}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`  Deployment info saved to: deployments/${filename}`);
  console.log("");

  console.log("████████████████████████████████████████████████████████████████████████████████");
  console.log("  NEXT STEPS");
  console.log("████████████████████████████████████████████████████████████████████████████████");
  console.log("");
  console.log("  1. Update .env with contract addresses:");
  console.log(`     ZEROP_TOKEN_ADDRESS=${zeropTokenAddress}`);
  console.log(`     OPERATOR_REGISTRY_ADDRESS=${operatorRegistryAddress}`);
  console.log(`     SUBNET_REWARDS_ADDRESS=${subnetRewardsAddress}`);
  console.log("");
  console.log("  2. Set backend reporter address:");
  console.log(`     await subnetRewards.setAuthorizedReporter("BACKEND_ADDRESS", true)`);
  console.log("");
  console.log("  3. For testnet - register as operator and stake:");
  console.log(`     1. Register: await operatorRegistry.registerOperator("https://your-ollama-endpoint", ["llama3.2", "mistral"])`);
  console.log(`     2. Approve: await zeropToken.approve(operatorRegistryAddress, stakeAmount)`);
  console.log(`     3. Stake:   await operatorRegistry.stake(stakeAmount)`);
  console.log("");
  if (isNativeZerop) {
    console.log("  4. Update frontend & API configs:");
    console.log(`     npx ts-node scripts/update-subnet-config.ts`);
    console.log("");
  }
  console.log("████████████████████████████████████████████████████████████████████████████████\n");

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
