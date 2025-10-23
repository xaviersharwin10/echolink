import React, { useState } from "react";
import { WagmiConfig } from "wagmi";
import { RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import "./App.css";
import { wagmiConfig, chains } from "./config/wagmi";
import { TransactionPopupProvider, NotificationProvider } from "@blockscout/app-sdk";
import { CreatorStudio } from "./components/CreatorStudio";
import { EchoGallery } from "./components/EchoGallery";
import { CreditManager } from "./components/CreditManager";
import { EchoLeaderboard } from "./components/EchoLeaderboard"; // NEW: Leaderboard component

function App() {
  const [activeTab, setActiveTab] = useState<'mint' | 'gallery' | 'credits' | 'leaderboard'>('mint');

  return (
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider chains={chains}>
        <NotificationProvider>
        <TransactionPopupProvider>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 font-sans">
          {/* Header */}
          <header className="bg-white shadow-md sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-700">
                    EchoLink
                  </h1>
                </div>
                <ConnectButton />
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Tab Navigation */}
            <div className="bg-white rounded-xl shadow-lg mb-8">
              <nav className="flex border-b border-gray-100">
                
                <TabButton 
                  label="🎨 Mint Echo" 
                  tab="mint" 
                  activeTab={activeTab} 
                  setActiveTab={setActiveTab} 
                />
                <TabButton 
                  label="💬 Chat with Echos" 
                  tab="gallery" 
                  activeTab={activeTab} 
                  setActiveTab={setActiveTab} 
                />
                <TabButton 
                  label="💳 Credits" 
                  tab="credits" 
                  activeTab={activeTab} 
                  setActiveTab={setActiveTab} 
                />
                <TabButton 
                  label="🏆 Leaderboard" 
                  tab="leaderboard" 
                  activeTab={activeTab} 
                  setActiveTab={setActiveTab} 
                />
              </nav>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8">
              {activeTab === 'mint' && <CreatorStudio />}
              {activeTab === 'gallery' && <EchoGallery />}
              {activeTab === 'credits' && <CreditManager />}
              {activeTab === 'leaderboard' && <EchoLeaderboard />} 
            </div>

            {/* Info Section */}
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Quick Start Guide</h3>
              <ul className="space-y-2 text-blue-800 text-sm">
                <li>✅ <strong>Step 1:</strong> Connect your wallet using the button in the top-right</li>
                <li>🎨 <strong>Step 2:</strong> Go to "Mint Echo" tab to upload your knowledge and create an Echo NFT</li>
                <li>💳 <strong>Step 3:</strong> Use "Credits" tab to purchase credits for seamless query payments</li>
                <li>💬 <strong>Step 4:</strong> Use "Chat with Echos" tab to browse and chat with available Echos</li>
                <li>🔬 <strong>Step 5:</strong> Use "AI Analyst" tab to ask questions about on-chain activity and get insights</li>
                <li>💰 <strong>Payment Options:</strong> Pay per query with PYUSD or use credits for convenience</li>
                <li>📁 <strong>Supported Files:</strong> TXT, PDF, DOCX, MP4, MOV, MP3, WAV</li>
              </ul>
            </div>
          </main>

          {/* Footer */}
          <footer className="mt-12 pb-8 text-center text-gray-500">
            <p className="text-sm">
              Powered by EchoLink • Web3 Knowledge Network
            </p>
          </footer>
        </div>
        </TransactionPopupProvider>
        </NotificationProvider>
      </RainbowKitProvider>
    </WagmiConfig>
  );
}

export default App;


// --- Helper Component for Tab Button Styling ---
interface TabButtonProps {
    label: string;
    tab: 'mint' | 'gallery' | 'credits' | 'leaderboard';
    activeTab: string;
    setActiveTab: React.Dispatch<React.SetStateAction<'mint' | 'gallery' | 'credits' | 'leaderboard'>>;
}

const TabButton: React.FC<TabButtonProps> = ({ label, tab, activeTab, setActiveTab }) => (
    <button
        onClick={() => setActiveTab(tab)}
        className={`flex-1 py-4 px-6 text-center font-semibold transition-all duration-200 border-b-2 
          ${activeTab === tab
            ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
            : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
        }`}
    >
        {label}
    </button>
);
