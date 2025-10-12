# EchoLink Frontend

React-based Web3 frontend for the EchoLink Protocol.

## Features

- 🔗 **Wallet Connection** - Connect MetaMask and other wallets via RainbowKit
- 🎨 **NFT Minting** - Mint Echo NFTs directly from the UI
- 💬 **AI Chat** - Query the knowledge base through an intuitive chat interface

## Tech Stack

- React 19
- TypeScript
- Wagmi (Web3 React hooks)
- RainbowKit (Wallet connection)
- Tailwind CSS (Styling)
- Viem (Ethereum interactions)

## Getting Started

### Install Dependencies

```bash
npm install
```

### Configure Contract

Update `src/config/contracts.ts` with your deployed contract address:

```typescript
export const ECHOLNK_NFT_ADDRESS = "0x..."; // Your deployed address
```

### Run Development Server

```bash
npm start
```

Opens at [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── components/
│   ├── MintEcho.tsx        # NFT minting component
│   └── ChatInterface.tsx   # AI chat component
├── config/
│   ├── wagmi.ts           # Web3 configuration
│   └── contracts.ts       # Contract ABI and address
├── App.tsx                # Main application
└── index.tsx             # Entry point
```

## Usage

### 1. Connect Wallet

Click "Connect Wallet" button and select your wallet provider.

### 2. Mint Echo NFT

1. Go to "Mint Echo" tab
2. Enter a knowledge hash
3. Click "Mint Echo"
4. Confirm transaction in wallet

### 3. Chat with AI

1. Go to "Chat Interface" tab
2. Type your question
3. Click "Send"
4. View AI response

## Configuration

### Network Setup

Edit `src/config/wagmi.ts` to change networks:

```typescript
const { chains, publicClient } = configureChains(
  [localhost, mainnet], // Add/remove networks
  [publicProvider()]
);
```

### Backend URL

The chat interface connects to `http://localhost:8000` by default.
Update in `src/components/ChatInterface.tsx` if needed.

## Building for Production

```bash
npm run build
```

Builds the app to the `build/` folder.

## Available Scripts

- `npm start` - Run development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App (irreversible)

## Troubleshooting

### Wallet won't connect
- Ensure MetaMask is installed
- Add Hardhat local network (see main README)
- Reset MetaMask account if needed

### Minting fails
- Check you're connected to the correct network
- Ensure you have enough ETH for gas
- Verify contract address is correct

### Chat doesn't work
- Ensure backend is running at http://localhost:8000
- Check browser console for errors
- Verify CORS is enabled on backend

## Learn More

- [React Documentation](https://react.dev/)
- [Wagmi Documentation](https://wagmi.sh/)
- [RainbowKit Documentation](https://www.rainbowkit.com/)
- [Tailwind CSS](https://tailwindcss.com/)
