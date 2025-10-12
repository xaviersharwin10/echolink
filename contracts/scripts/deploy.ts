import { ethers } from "hardhat";

async function main() {
  console.log("Deploying EchoNFT contract...");

  const EchoNFT = await ethers.getContractFactory("EchoNFT");
  const echoNFT = await EchoNFT.deploy();

  await echoNFT.waitForDeployment();

  const address = await echoNFT.getAddress();
  console.log("EchoNFT deployed to:", address);
  
  // Get the owner address
  const owner = await echoNFT.owner();
  console.log("Contract owner:", owner);
  
  console.log("\n=================================");
  console.log("Deployment Summary");
  console.log("=================================");
  console.log("Contract Address:", address);
  console.log("Owner Address:", owner);
  console.log("\nUpdate this address in:");
  console.log("  frontend/src/config/contracts.ts");
  console.log("=================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

