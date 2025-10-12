import React, { useState } from "react";
import { WagmiConfig } from "wagmi";
import { RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import "./App.css";
import { wagmiConfig, chains } from "./config/wagmi";
import { MintEcho } from "./components/MintEcho";
import { EchoSelector } from "./components/EchoSelector";

function App() {
  const [activeTab, setActiveTab] = useState<'mint' | 'chat'>('mint');

  return (
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider chains={chains}>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
          {/* Header */}
          <header className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                    EchoLink Protocol
                  </h1>
                </div>
                <ConnectButton />
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Tab Navigation */}
            <div className="bg-white rounded-lg shadow-sm mb-6">
              <nav className="flex border-b">
                <button
                  onClick={() => setActiveTab('mint')}
                  className={`flex-1 py-4 px-6 text-center font-semibold transition-colors ${
                    activeTab === 'mint'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  🎨 Mint Echo
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 py-4 px-6 text-center font-semibold transition-colors ${
                    activeTab === 'chat'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  💬 Chat with Echos
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              {activeTab === 'mint' && <MintEcho />}
              {activeTab === 'chat' && <EchoSelector />}
            </div>

            {/* Info Section */}
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Quick Start Guide</h3>
              <ul className="space-y-2 text-blue-800 text-sm">
                <li>✅ <strong>Step 1:</strong> Connect your wallet using the button in the top-right</li>
                <li>🎨 <strong>Step 2:</strong> Go to "Mint Echo" tab to create your knowledge NFT</li>
                <li>💬 <strong>Step 3:</strong> Use "Chat with Echos" tab to browse and chat with available Echos</li>
                <li>💰 <strong>Note:</strong> Each query costs 0.1 PYUSD and goes to the Echo's creator</li>
              </ul>
            </div>
          </main>

          {/* Footer */}
          <footer className="mt-12 pb-8 text-center text-gray-600">
            <p className="text-sm">
              Powered by EchoLink • Web3 Knowledge Network
            </p>
          </footer>
        </div>
      </RainbowKitProvider>
    </WagmiConfig>
  );
}

export default App;