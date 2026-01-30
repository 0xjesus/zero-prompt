import * as fs from "fs";
import * as path from "path";

/**
 * update-subnet-config.ts
 *
 * Reads the latest subnet deployment artifacts and updates:
 *   1. apps/zeroprompt/lib/subnetContracts.ts  - contract addresses & RPC
 *   2. apps/contracts/.env                     - contract addresses & RPC URL
 *   3. apps/api/src/services/subnetNodes.ts    - (no hardcoded addresses, config-driven)
 *
 * Usage:
 *   npx ts-node scripts/update-subnet-config.ts
 *   npx ts-node scripts/update-subnet-config.ts --deployment subnet-zeropromptSubnet.json
 */

interface DeploymentInfo {
  network: string;
  chainId: number;
  deployer: string;
  deploymentTime: string;
  contracts: {
    zeropToken: string;
    operatorRegistry: string;
    subnetRewards: string;
  };
  treasury: string;
  transactions: Record<string, string>;
}

interface SubnetInfo {
  subnetId: string;
  blockchainId: string;
  rpcUrl: string;
  chainId: number;
  vmId: string;
  deployTarget: string;
  deployedAt: string;
}

function findLatestDeployment(): DeploymentInfo {
  const deploymentsDir = path.join(__dirname, "..", "deployments");

  // Look for subnet deployment files, prefer zeropromptSubnet
  const candidates = [
    "subnet-zeropromptSubnet.json",
    "subnet-zeropromptSubnetTestnet.json",
  ];

  for (const filename of candidates) {
    const filepath = path.join(deploymentsDir, filename);
    if (fs.existsSync(filepath)) {
      console.log(`  Found deployment: ${filename}`);
      return JSON.parse(fs.readFileSync(filepath, "utf-8"));
    }
  }

  // Fall back to any subnet-*.json
  if (fs.existsSync(deploymentsDir)) {
    const files = fs.readdirSync(deploymentsDir).filter(f => f.startsWith("subnet-") && f.endsWith(".json"));
    if (files.length > 0) {
      const latest = files.sort().pop()!;
      console.log(`  Found deployment: ${latest}`);
      return JSON.parse(fs.readFileSync(path.join(deploymentsDir, latest), "utf-8"));
    }
  }

  throw new Error(
    "No deployment file found. Run deploy-subnet.ts first:\n" +
    "  npx hardhat run scripts/deploy-subnet.ts --network zeropromptSubnet"
  );
}

function loadSubnetInfo(): SubnetInfo | null {
  const filepath = path.join(__dirname, "..", "subnet", "deployment-info.json");
  if (fs.existsSync(filepath)) {
    return JSON.parse(fs.readFileSync(filepath, "utf-8"));
  }
  return null;
}

function updateSubnetContracts(deployment: DeploymentInfo, rpcUrl: string): void {
  const filePath = path.resolve(__dirname, "../../zeroprompt/lib/subnetContracts.ts");

  if (!fs.existsSync(filePath)) {
    console.log("  SKIP: subnetContracts.ts not found at", filePath);
    return;
  }

  let content = fs.readFileSync(filePath, "utf-8");

  // Update contract addresses
  const replacements: [RegExp, string][] = [
    [
      /export const ZEROP_TOKEN_ADDRESS = '[^']+'/,
      `export const ZEROP_TOKEN_ADDRESS = '${deployment.contracts.zeropToken}'`,
    ],
    [
      /export const OPERATOR_REGISTRY_ADDRESS = '[^']+'/,
      `export const OPERATOR_REGISTRY_ADDRESS = '${deployment.contracts.operatorRegistry}'`,
    ],
    [
      /export const SUBNET_REWARDS_ADDRESS = '[^']+'/,
      `export const SUBNET_REWARDS_ADDRESS = '${deployment.contracts.subnetRewards}'`,
    ],
  ];

  // Update default RPC URL if we have subnet info
  if (rpcUrl) {
    replacements.push([
      /\|\| '[^']+'/,  // matches the fallback URL in SUBNET_RPC
      `|| '${rpcUrl}'`,
    ]);
  }

  for (const [pattern, replacement] of replacements) {
    content = content.replace(pattern, replacement);
  }

  fs.writeFileSync(filePath, content);
  console.log("  UPDATED: apps/zeroprompt/lib/subnetContracts.ts");
  console.log(`    ZEROP_TOKEN_ADDRESS = ${deployment.contracts.zeropToken}`);
  console.log(`    OPERATOR_REGISTRY_ADDRESS = ${deployment.contracts.operatorRegistry}`);
  console.log(`    SUBNET_REWARDS_ADDRESS = ${deployment.contracts.subnetRewards}`);
}

function updateEnvFile(deployment: DeploymentInfo, rpcUrl: string): void {
  const envPath = path.resolve(__dirname, "../.env");
  const envExamplePath = path.resolve(__dirname, "../.env.example");

  const envVars: Record<string, string> = {
    ZEROP_TOKEN_ADDRESS: deployment.contracts.zeropToken,
    OPERATOR_REGISTRY_ADDRESS: deployment.contracts.operatorRegistry,
    SUBNET_REWARDS_ADDRESS: deployment.contracts.subnetRewards,
  };

  if (rpcUrl) {
    envVars.ZEROPROMPT_SUBNET_RPC_URL = rpcUrl;
  }

  // Update .env if it exists, otherwise create it
  let envContent = "";
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf-8");
  }

  for (const [key, value] of Object.entries(envVars)) {
    const pattern = new RegExp(`^${key}=.*$`, "m");
    const line = `${key}=${value}`;

    if (pattern.test(envContent)) {
      envContent = envContent.replace(pattern, line);
    } else {
      envContent += `\n${line}`;
    }
  }

  fs.writeFileSync(envPath, envContent.trim() + "\n");
  console.log("  UPDATED: apps/contracts/.env");

  // Also write .env.example with placeholder values
  const exampleLines = Object.keys(envVars)
    .map((key) => `${key}=`)
    .join("\n");

  let exampleContent = "";
  if (fs.existsSync(envExamplePath)) {
    exampleContent = fs.readFileSync(envExamplePath, "utf-8");
  }

  // Only add keys not already present
  for (const key of Object.keys(envVars)) {
    if (!exampleContent.includes(`${key}=`)) {
      exampleContent += `\n${key}=`;
    }
  }

  if (exampleContent.trim()) {
    fs.writeFileSync(envExamplePath, exampleContent.trim() + "\n");
    console.log("  UPDATED: apps/contracts/.env.example");
  }
}

async function main() {
  console.log("\n");
  console.log("========================================================================");
  console.log("  ZeroPrompt Subnet Config Updater");
  console.log("========================================================================\n");

  // Parse optional --deployment flag
  const deploymentArg = process.argv.find((a) => a.startsWith("--deployment"));
  let deployment: DeploymentInfo;

  if (deploymentArg) {
    const filename = process.argv[process.argv.indexOf(deploymentArg) + 1];
    const filepath = path.join(__dirname, "..", "deployments", filename);
    deployment = JSON.parse(fs.readFileSync(filepath, "utf-8"));
    console.log(`  Using specified deployment: ${filename}`);
  } else {
    deployment = findLatestDeployment();
  }

  // Load subnet deployment info for RPC URL
  const subnetInfo = loadSubnetInfo();
  const rpcUrl = subnetInfo?.rpcUrl || "";

  console.log(`\n  Network:    ${deployment.network}`);
  console.log(`  Chain ID:   ${deployment.chainId}`);
  console.log(`  Deployer:   ${deployment.deployer}`);
  console.log(`  Deployed:   ${deployment.deploymentTime}`);
  if (rpcUrl) {
    console.log(`  RPC URL:    ${rpcUrl}`);
  }
  console.log("");

  // Update files
  console.log("  Updating config files...\n");

  updateSubnetContracts(deployment, rpcUrl);
  console.log("");

  updateEnvFile(deployment, rpcUrl);
  console.log("");

  console.log("========================================================================");
  console.log("  Config update complete!");
  console.log("========================================================================\n");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
