import { ethers } from "hardhat";

async function main() {
  console.log("Deploying EchoNFT contract...");
  const pyusdToken = "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9";
  const EchoNFT = await ethers.getContractFactory("EchoNFT");
  const echoNFT = await EchoNFT.deploy(pyusdToken);

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

