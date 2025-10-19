import { configureChains, createConfig } from "wagmi";
import { mainnet } from "wagmi/chains";
import { publicProvider } from "wagmi/providers/public";
import { getDefaultWallets } from "@rainbow-me/rainbowkit";

// Define localhost manually
const localhost = {
  id: 31337,
  name: "Localhost",
  network: "localhost",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
    public: { http: ["http://127.0.0.1:8545"] },
  },
};

// Define Sepolia manually with a reliable RPC (Alchemy/Infura)
const sepolia = {
  id: 11155111,
  name: "Sepolia",
  network: "sepolia",
  nativeCurrency: {
    name: "Sepolia Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://eth-sepolia.g.alchemy.com/v2/472NtbGQX-PS0AyJjYV5qBMx9mfg78Le"] },
    public: { http: ["https://eth-sepolia.g.alchemy.com/v2/472NtbGQX-PS0AyJjYV5qBMx9mfg78Le"] },
  },
};

const { chains, publicClient } = configureChains(
  [localhost, sepolia, mainnet],
  [publicProvider()] // fallback providerecholink-protocol/contracts/scripts
);

const { connectors } = getDefaultWallets({
  appName: "EchoLink Protocol",
  projectId: "1a240ae3b33be6f8e103b0ab20f114af",
  chains,
});

export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
});

export { chains };
