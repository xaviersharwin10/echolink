import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const EchoNFTModule = buildModule("EchoNFTModule", (m) => {
  const echoNFT = m.contract("EchoNFT");

  return { echoNFT };
});

export default EchoNFTModule;

