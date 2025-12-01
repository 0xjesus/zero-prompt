import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env from root
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function main() {
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    console.error("❌ PRIVATE_KEY not found in .env");
    process.exit(1);
  }

  // Get wallet from private key
  const wallet = new ethers.Wallet(privateKey);
  const address = wallet.address;

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("                    WALLET BALANCE CHECK");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`\n📍 Wallet Address: ${address}`);

  // Get provider from hardhat
  const provider = ethers.provider;
  const network = await provider.getNetwork();

  console.log(`🌐 Network: ${network.name} (Chain ID: ${network.chainId})`);

  // Get balance
  const balance = await provider.getBalance(address);
  const balanceInAVAX = ethers.formatEther(balance);

  console.log(`\n💰 Balance: ${balanceInAVAX} AVAX`);
  console.log(`   (${balance.toString()} wei)`);

  // Estimate deployment cost
  const estimatedGasPrice = await provider.getFeeData();
  const gasPrice = estimatedGasPrice.gasPrice || BigInt(25000000000); // 25 gwei default

  // Approximate gas for contract deployment (around 2M gas)
  const estimatedGas = BigInt(2000000);
  const estimatedCost = gasPrice * estimatedGas;
  const estimatedCostAVAX = ethers.formatEther(estimatedCost);

  console.log(`\n📊 Estimated deployment cost: ~${estimatedCostAVAX} AVAX`);
  console.log(`   Gas Price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);

  if (balance < estimatedCost) {
    console.log(`\n⚠️  INSUFFICIENT FUNDS for deployment!`);
    console.log(`   Need at least: ${estimatedCostAVAX} AVAX`);
    console.log(`   Missing: ${ethers.formatEther(estimatedCost - balance)} AVAX`);
    console.log(`\n💡 Send AVAX to: ${address}`);
  } else {
    console.log(`\n✅ Sufficient funds for deployment!`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
