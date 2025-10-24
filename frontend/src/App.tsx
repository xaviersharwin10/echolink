import React, { useState, useEffect} from "react";
import { WagmiConfig } from "wagmi";
import { RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import "./App.css";
import { wagmiConfig, chains } from "./config/wagmi";
import { TransactionPopupProvider, NotificationProvider } from "@blockscout/app-sdk";
import { EchoDashboard } from "./components/EchoDashboard";
import { CreatorStudio } from "./components/CreatorStudio";
import { EchoGallery } from "./components/EchoGallery";
import { CreditManager } from "./components/CreditManager";
import { EchoLeaderboard } from "./components/EchoLeaderboard";
import { DiscoveryPage } from "./components/DiscoveryPage";

// --- Floating Chatbot Component ---
const FloatingChatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <>
            {/* 1. Pop-up Window */}
            {isOpen && (
                <div 
                  className="fixed bottom-24 right-6 w-full max-w-lg h-[900px] bg-white border border-gray-300 rounded-xl shadow-2xl z-50 overflow-hidden transition-all duration-300 transform scale-100"
                  style={{ maxHeight: 'calc(100vh - 100px)' }}
                >
                  <div className="flex justify-between items-center p-3 bg-purple-600 text-white shadow-md">
                    <h4 className="text-lg font-semibold">🤖 AI Analyst (Blockscout MCP)</h4>
                    <button 
                      onClick={() => setIsOpen(false)}
                      className="text-white hover:text-purple-200 transition-colors p-1 rounded-full hover:bg-purple-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="h-[calc(100%-48px)] overflow-y-auto">
                    <DiscoveryPage isWidget={true} /> 
                  </div>
                </div>
            )}
            
            {/* 2. Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 p-4 bg-purple-600 text-white rounded-full shadow-xl hover:bg-purple-700 transition-all duration-300 z-50 transform hover:scale-105"
                title="Open AI Analyst"
            >
                {isOpen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                )}
            </button>
        </>
    );
}

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'mint' | 'gallery' | 'credits' | 'leaderboard'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

   useEffect(() => {
    // Request notification permissions on app load
    if ("Notification" in window) {
      Notification.requestPermission().then(permission => {
        console.log("Notification permission:", permission);
      });
    }
    console.log("App mounted, notification providers initialized");
  }, []);


  return (
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider chains={chains}>
        <NotificationProvider>
        <TransactionPopupProvider>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 font-sans">
          {/* Header */}
          <header className="bg-white/80 backdrop-blur-md shadow-lg sticky top-0 z-50 border-b border-white/20">
            <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-8">
                  <h1 
                    className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-700 cursor-pointer hover:from-blue-700 hover:to-indigo-800 transition-all duration-300"
                    onClick={() => setActiveTab('dashboard')}
                  >
                    EchoLink
                  </h1>
                  
                  {/* Desktop Navigation */}
                  <nav className="hidden md:flex space-x-1">
                    <NavButton 
                      label="🏠 Dashboard" 
                      tab="dashboard" 
                      activeTab={activeTab} 
                      setActiveTab={setActiveTab} 
                    />
                    <NavButton 
                      label="🎨 Create" 
                      tab="mint" 
                      activeTab={activeTab} 
                      setActiveTab={setActiveTab} 
                    />
                    <NavButton 
                      label="💬 Explore" 
                      tab="gallery" 
                      activeTab={activeTab} 
                      setActiveTab={setActiveTab} 
                    />
                    <NavButton 
                      label="💳 Credits" 
                      tab="credits" 
                      activeTab={activeTab} 
                      setActiveTab={setActiveTab} 
                    />
                    <NavButton 
                      label="🏆 Leaderboard" 
                      tab="leaderboard" 
                      activeTab={activeTab} 
                      setActiveTab={setActiveTab} 
                    />
                  </nav>

                  {/* Mobile Menu Button */}
                  <button
                    className="md:hidden p-2 rounded-lg text-gray-600 hover:text-gray-800 hover:bg-white/50 transition-colors"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </div>
                <ConnectButton />
              </div>
            </div>
          </header>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden bg-white/95 backdrop-blur-md border-b border-white/20 shadow-lg">
              <div className="px-4 py-4 space-y-2">
                <MobileNavButton 
                  label="🏠 Dashboard" 
                  tab="dashboard" 
                  activeTab={activeTab} 
                  setActiveTab={(tab) => {
                    setActiveTab(tab);
                    setIsMobileMenuOpen(false);
                  }} 
                />
                <MobileNavButton 
                  label="🎨 Create Echo" 
                  tab="mint" 
                  activeTab={activeTab} 
                  setActiveTab={(tab) => {
                    setActiveTab(tab);
                    setIsMobileMenuOpen(false);
                  }} 
                />
                <MobileNavButton 
                  label="💬 Explore Gallery" 
                  tab="gallery" 
                  activeTab={activeTab} 
                  setActiveTab={(tab) => {
                    setActiveTab(tab);
                    setIsMobileMenuOpen(false);
                  }} 
                />
                <MobileNavButton 
                  label="💳 Credits" 
                  tab="credits" 
                  activeTab={activeTab} 
                  setActiveTab={(tab) => {
                    setActiveTab(tab);
                    setIsMobileMenuOpen(false);
                  }} 
                />
                <MobileNavButton 
                  label="🏆 Leaderboard" 
                  tab="leaderboard" 
                  activeTab={activeTab} 
                  setActiveTab={(tab) => {
                    setActiveTab(tab);
                    setIsMobileMenuOpen(false);
                  }} 
                />
              </div>
            </div>
          )}

          {/* Main Content */}
          <main className="w-full">
            {activeTab === 'dashboard' && <EchoDashboard onNavigate={setActiveTab} />}
            {activeTab === 'mint' && (
              <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
                <CreatorStudio />
              </div>
            )}
            {activeTab === 'gallery' && <EchoGallery />}
            {activeTab === 'credits' && (
              <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
                <CreditManager />
              </div>
            )}
            {activeTab === 'leaderboard' && (
              <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
                <EchoLeaderboard />
              </div>
            )}
          </main>
          <FloatingChatbot />
          {/* Footer */}
          <footer className="mt-12 pb-8 text-center text-gray-500 bg-white/40 backdrop-blur-sm">
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


// --- Helper Component for Navigation Button Styling ---
interface NavButtonProps {
    label: string;
    tab: 'dashboard' | 'mint' | 'gallery' | 'credits' | 'leaderboard';
    activeTab: string;
    setActiveTab: React.Dispatch<React.SetStateAction<'dashboard' | 'mint' | 'gallery' | 'credits' | 'leaderboard'>>;
}

const NavButton: React.FC<NavButtonProps> = ({ label, tab, activeTab, setActiveTab }) => (
    <button
        onClick={() => setActiveTab(tab)}
        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-300 transform hover:scale-105
          ${activeTab === tab
            ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg'
            : 'text-gray-600 hover:text-gray-800 hover:bg-white/50 backdrop-blur-sm'
        }`}
    >
        {label}
    </button>
);

const MobileNavButton: React.FC<NavButtonProps> = ({ label, tab, activeTab, setActiveTab }) => (
    <button
        onClick={() => setActiveTab(tab)}
        className={`w-full text-left px-4 py-3 text-base font-semibold rounded-lg transition-all duration-300
          ${activeTab === tab
            ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg'
            : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
        }`}
    >
        {label}
    </button>
);
