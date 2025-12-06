import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * ███╗   ███╗ ██████╗ ██████╗ ███████╗██╗          ██████╗ ███████╗██████╗ ██╗   ██╗████████╗ █████╗ ████████╗██╗ ██████╗ ███╗   ██╗
 * ████╗ ████║██╔═══██╗██╔══██╗██╔════╝██║          ██╔══██╗██╔════╝██╔══██╗██║   ██║╚══██╔══╝██╔══██╗╚══██╔══╝██║██╔═══██╗████╗  ██║
 * ██╔████╔██║██║   ██║██║  ██║█████╗  ██║          ██████╔╝█████╗  ██████╔╝██║   ██║   ██║   ███████║   ██║   ██║██║   ██║██╔██╗ ██║
 * ██║╚██╔╝██║██║   ██║██║  ██║██╔══╝  ██║          ██╔══██╗██╔══╝  ██╔═══╝ ██║   ██║   ██║   ██╔══██║   ██║   ██║██║   ██║██║╚██╗██║
 * ██║ ╚═╝ ██║╚██████╔╝██████╔╝███████╗███████╗     ██║  ██║███████╗██║     ╚██████╔╝   ██║   ██║  ██║   ██║   ██║╚██████╔╝██║ ╚████║
 * ╚═╝     ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝╚══════╝     ╚═╝  ╚═╝╚══════╝╚═╝      ╚═════╝    ╚═╝   ╚═╝  ╚═╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
 *
 * ERC-8004 Model Reputation Registry - Deployment Script
 *
 * Deploys the decentralized reputation system for AI models.
 * Uses database model.id as agentId for direct mapping.
 */

const NETWORK_NAMES: Record<string, string> = {
  avalanche: "Avalanche C-Chain",
  avalancheFuji: "Avalanche Fuji Testnet",
  ethereum: "Ethereum Mainnet",
  sepolia: "Ethereum Sepolia",
  arbitrum: "Arbitrum One",
  arbitrumSepolia: "Arbitrum Sepolia",
  polygon: "Polygon Mainnet",
  base: "Base Mainnet",
  baseSepolia: "Base Sepolia",
  optimism: "Optimism Mainnet",
  bsc: "BNB Smart Chain",
  hardhat: "Hardhat Local",
  localhost: "Localhost"
};

interface DeploymentInfo {
  network: string;
  networkName: string;
  chainId: number;
  contractAddress: string;
  deployer: string;
  deploymentTime: string;
  transactionHash: string;
  blockNumber: number;
}

async function main() {
  const networkName = network.name;
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log("\n");
  console.log("████████████████████████████████████████████████████████████████████████████████");
  console.log("  MODEL REPUTATION REGISTRY (ERC-8004) DEPLOYMENT");
  console.log("████████████████████████████████████████████████████████████████████████████████");
  console.log(`\n  Network: ${NETWORK_NAMES[networkName] || networkName}`);
  console.log(`  Chain ID: ${chainId}`);
  console.log("");

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance: ${ethers.formatEther(balance)} native tokens`);
  console.log("");

  console.log("  Deploying ModelReputationRegistry contract...");
  console.log("");

  const ModelReputationRegistry = await ethers.getContractFactory("ModelReputationRegistry");
  const registry = await ModelReputationRegistry.deploy();

  await registry.waitForDeployment();
  const contractAddress = await registry.getAddress();

  const deployTx = registry.deploymentTransaction();
  const receipt = await deployTx?.wait();

  console.log("████████████████████████████████████████████████████████████████████████████████");
  console.log("  DEPLOYMENT SUCCESSFUL!");
  console.log("████████████████████████████████████████████████████████████████████████████████");
  console.log("");
  console.log(`  Contract Address: ${contractAddress}`);
  console.log(`  Transaction Hash: ${deployTx?.hash}`);
  console.log(`  Block Number: ${receipt?.blockNumber}`);
  console.log(`  Gas Used: ${receipt?.gasUsed.toString()}`);
  console.log("");

  // Verify owner
  const owner = await registry.owner();
  console.log(`  Owner: ${owner}`);
  console.log("");

  // Save deployment info
  const deploymentInfo: DeploymentInfo = {
    network: networkName,
    networkName: NETWORK_NAMES[networkName] || networkName,
    chainId: Number(chainId),
    contractAddress,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    transactionHash: deployTx?.hash || "",
    blockNumber: receipt?.blockNumber || 0
  };

  // Create deployments directory if needed
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save to file
  const filename = `reputation-${networkName}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`  Deployment info saved to: deployments/${filename}`);

  console.log("");
  console.log("████████████████████████████████████████████████████████████████████████████████");
  console.log("  NEXT STEPS");
  console.log("████████████████████████████████████████████████████████████████████████████████");
  console.log("");
  console.log("  1. Verify contract on block explorer:");
  console.log(`     npx hardhat verify --network ${networkName} ${contractAddress}`);
  console.log("");
  console.log("  2. Register your AI models:");
  console.log(`     await registry.registerAgent(1, "anthropic/claude-3.5-sonnet")`);
  console.log(`     await registry.registerAgents([1,2,3], ["model1","model2","model3"])`);
  console.log("");
  console.log("  3. Update .env with contract address:");
  console.log(`     EXPO_PUBLIC_MODEL_REPUTATION_REGISTRY=${contractAddress}`);
  console.log("");
  console.log("████████████████████████████████████████████████████████████████████████████████\n");

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
