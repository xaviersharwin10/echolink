import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying QueryPayments contract...");

  // PYUSD contract address on Sepolia testnet
  const pyusdAddress = "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9";

  // Get the contract factory
  const QueryPayments = await ethers.getContractFactory("QueryPayments");

  // Deploy the contract, passing the PYUSD address to constructor
  const queryPayments = await QueryPayments.deploy(pyusdAddress);

  // Wait for deployment to complete
  await queryPayments.waitForDeployment();

  const address = await queryPayments.getAddress();
  console.log("✅ QueryPayments deployed to:", address);

  // Get the owner address
  const owner = await queryPayments.owner();
  console.log("👑 Contract owner:", owner);

  console.log("\n=================================");
  console.log("📜 Deployment Summary");
  console.log("=================================");
  console.log("Contract Address:", address);
  console.log("Owner Address:", owner);
  console.log("Token Address (PYUSD):", pyusdAddress);
  console.log("\nUpdate this address in:");
  console.log("  frontend/src/config/contracts.ts");
  console.log("=================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
