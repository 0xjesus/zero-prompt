import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * ████████╗███████╗██████╗  ██████╗ ██████╗ ██████╗  ██████╗ ███╗   ███╗██████╗ ████████╗
 * ╚══███╔╝██╔════╝██╔══██╗██╔═══██╗██╔══██╗██╔══██╗██╔═══██╗████╗ ████║██╔══██╗╚══███╔╝
 *   ███╔╝ █████╗  ██████╔╝██║   ██║██████╔╝██████╔╝██║   ██║██╔████╔██║██████╔╝  ███╔╝
 *  ███╔╝  ██╔══╝  ██╔══██╗██║   ██║██╔═══╝ ██╔══██╗██║   ██║██║╚██╔╝██║██╔═══╝  ███╔╝
 * ███████╗███████╗██║  ██║╚██████╔╝██║     ██║  ██║╚██████╔╝██║ ╚═╝ ██║██║     ███████╗
 * ╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚══════╝
 *
 * ZeroPrompt Billing Contract Deployment Script
 */

// Chainlink Price Feeds for Native Token / USD
const PRICE_FEEDS: Record<string, string> = {
  // Avalanche
  avalanche: "0x0A77230d17318075983913bC2145DB16C7366156",      // AVAX/USD
  avalancheFuji: "0x5498BB86BC934c8D34FDA08E81D444153d0D06aD",  // AVAX/USD Testnet

  // Ethereum
  ethereum: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",       // ETH/USD
  sepolia: "0x694AA1769357215DE4FAC081bf1f309aDC325306",        // ETH/USD Sepolia

  // Arbitrum
  arbitrum: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",       // ETH/USD on Arbitrum
  arbitrumSepolia: "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165", // ETH/USD Arbitrum Sepolia

  // Polygon
  polygon: "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0",        // MATIC/USD

  // Base
  base: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",           // ETH/USD on Base
  baseSepolia: "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1",    // ETH/USD Base Sepolia

  // Optimism
  optimism: "0x13e3Ee699D1909E989722E753853AE30b17e08c5",       // ETH/USD on Optimism

  // BNB Chain
  bsc: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE",            // BNB/USD

  // Local (mock)
  hardhat: "MOCK",
  localhost: "MOCK"
};

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
  priceFeedAddress: string;
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
  console.log("  ZEROPROMPT BILLING CONTRACT DEPLOYMENT");
  console.log("████████████████████████████████████████████████████████████████████████████████");
  console.log(`\n  Network: ${NETWORK_NAMES[networkName] || networkName}`);
  console.log(`  Chain ID: ${chainId}`);
  console.log("");

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance: ${ethers.formatEther(balance)} native tokens`);
  console.log("");

  const priceFeedAddress = PRICE_FEEDS[networkName];
  if (!priceFeedAddress) {
    throw new Error(`No price feed configured for network: ${networkName}`);
  }

  let finalPriceFeed = priceFeedAddress;

  // For local networks, deploy a mock price feed
  if (priceFeedAddress === "MOCK") {
    console.log("  Deploying Mock Price Feed for local testing...");
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const mockFeed = await MockPriceFeed.deploy(8, "AVAX/USD", 1);
    await mockFeed.waitForDeployment();
    finalPriceFeed = await mockFeed.getAddress();

    // Set initial price ($25 AVAX)
    await mockFeed.updateAnswer(2500000000);

    console.log(`  Mock Price Feed deployed: ${finalPriceFeed}`);
    console.log("");
  }

  console.log(`  Price Feed: ${finalPriceFeed}`);
  console.log("");

  console.log("  Deploying ZeroPromptBilling contract...");
  console.log("");

  const ZeroPromptBilling = await ethers.getContractFactory("ZeroPromptBilling");
  const billing = await ZeroPromptBilling.deploy(finalPriceFeed);

  await billing.waitForDeployment();
  const contractAddress = await billing.getAddress();

  const deployTx = billing.deploymentTransaction();
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

  // Get initial config
  const minDeposit = await billing.minDepositUSD();
  const freeCredits = await billing.freeCreditsUSD();

  console.log("  Initial Configuration:");
  console.log(`  - Min Deposit: $${ethers.formatEther(minDeposit)}`);
  console.log(`  - Free Credits: $${ethers.formatEther(freeCredits)}`);

  if (priceFeedAddress !== "MOCK") {
    try {
      const price = await billing.getNativeTokenPrice();
      console.log(`  - Current Price: $${Number(price) / 1e8}`);
    } catch {
      console.log("  - Current Price: (unable to fetch)");
    }
  }
  console.log("");

  // Save deployment info
  const deploymentInfo: DeploymentInfo = {
    network: networkName,
    networkName: NETWORK_NAMES[networkName] || networkName,
    chainId: Number(chainId),
    contractAddress,
    priceFeedAddress: finalPriceFeed,
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
  const filename = `${networkName}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`  Deployment info saved to: deployments/${filename}`);

  // Also save combined deployments file
  const allDeploymentsPath = path.join(deploymentsDir, "all-deployments.json");
  let allDeployments: Record<string, DeploymentInfo> = {};
  if (fs.existsSync(allDeploymentsPath)) {
    allDeployments = JSON.parse(fs.readFileSync(allDeploymentsPath, "utf8"));
  }
  allDeployments[networkName] = deploymentInfo;
  fs.writeFileSync(allDeploymentsPath, JSON.stringify(allDeployments, null, 2));

  console.log("");
  console.log("████████████████████████████████████████████████████████████████████████████████");
  console.log("  NEXT STEPS");
  console.log("████████████████████████████████████████████████████████████████████████████████");
  console.log("");
  console.log("  1. Verify contract on block explorer:");
  console.log(`     npx hardhat verify --network ${networkName} ${contractAddress} ${finalPriceFeed}`);
  console.log("");
  console.log("  2. Add backend operator:");
  console.log(`     await billing.setOperator("BACKEND_ADDRESS", true)`);
  console.log("");
  console.log("  3. Update .env with contract address:");
  console.log(`     ZEROPROMPT_BILLING_${networkName.toUpperCase()}=${contractAddress}`);
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
