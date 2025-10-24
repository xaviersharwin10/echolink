import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { EchoCard, EchoInfo } from './EchoCard';
import { readContract } from '@wagmi/core';
import { ECHOLNK_NFT_ADDRESS, ECHO_NFT_ABI } from '../config/contracts';

const API_BASE_URL = 'https://eth-sepolia.blockscout.com/api/v2';
const ACTIVITY_THRESHOLD = 3;
const PYUSD_TOKEN_ADDRESS = '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9';

const featuredEchos: { [key: number]: { name: string; description: string; imageUrl: string; category: string } } = {
  1: { 
    name: "Economic Principles", 
    description: "Master foundational economic theories and models with interactive AI guidance.", 
    imageUrl: "https://images.unsplash.com/photo-1579532537598-459ecdaf39cc?w=800",
    category: "Economics"
  },
  2: { 
    name: "The Startup Playbook", 
    description: "Learn from Silicon Valley's most successful founders and their strategies.", 
    imageUrl: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800",
    category: "Business"
  },
  3: { 
    name: "History of Rome", 
    description: "Explore the rise and fall of the Roman Empire with interactive historical insights.", 
    imageUrl: "https://images.unsplash.com/photo-1589191224392-a9a358a98a83?w=800",
    category: "History"
  },
  4: { 
    name: "Quantum Physics AI", 
    description: "Dive into the fascinating world of quantum mechanics and modern physics.", 
    imageUrl: "https://images.unsplash.com/photo-1593352222493-26a96c6344b9?w=800",
    category: "Science"
  },
};

interface EchoDashboardProps {
  onNavigate: (tab: 'dashboard' | 'mint' | 'gallery' | 'credits' | 'leaderboard') => void;
}

export const EchoDashboard: React.FC<EchoDashboardProps> = ({ onNavigate }) => {
  const [featuredEchoList, setFeaturedEchoList] = useState<EchoInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEchos: 0,
    activeUsers: 0,
    totalQueries: 0
  });
  const { address, isConnected } = useAccount();

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      const foundEchos: EchoInfo[] = [];

      try {
        // Get all Echos from the contract
        const allEchoesData = await readContract({
          address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
          abi: ECHO_NFT_ABI,
          functionName: 'getAllEchoes',
        });

        const [tokenIds, names, descriptions, creators, pricesPerQuery, activeStatuses] = allEchoesData as [
          bigint[], string[], string[], `0x${string}`[], bigint[], boolean[]];

        let totalQueries = 0;
        let activeUsers = 0;

        // Process featured echos (limit to 4 for dashboard)
        for (let i = 0; i < Math.min(tokenIds.length, 4); i++) {
          const tokenId = Number(tokenIds[i]);
          const name = names[i];
          const description = descriptions[i];
          const creator = creators[i];
          const pricePerQuery = pricesPerQuery[i];
          const isActive = activeStatuses[i];

          try {
            const owner = await readContract({
              address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
              abi: ECHO_NFT_ABI,
              functionName: 'ownerOf',
              args: [BigInt(tokenId)],
            });

            const activityRes = await fetch(`${API_BASE_URL}/addresses/${creator}/token-transfers?token=${PYUSD_TOKEN_ADDRESS}`);
            const activityData = await activityRes.json();
            const incomingTransfers = activityData?.items.filter((tx: any) => tx.to.hash.toLowerCase() === creator.toLowerCase());
            const queries = incomingTransfers.length || 0;
            
            totalQueries += queries;
            if (queries > ACTIVITY_THRESHOLD) activeUsers++;

            const hardcoded = featuredEchos[tokenId] || {
              name: name || `Echo #${tokenId}`,
              description: description || "An AI entity containing unique knowledge, ready for exploration.",
              imageUrl: `https://source.unsplash.com/random/800x600?sig=${tokenId}`,
              category: "General"
            };
            
            foundEchos.push({
              tokenId: tokenId,
              owner: owner as string,
              creator: creator,
              isCreatorActive: queries > ACTIVITY_THRESHOLD,
              totalQueries: queries,
              pricePerQuery: pricePerQuery,
              ...hardcoded
            });

          } catch (error) {
            console.warn(`Failed to fetch data for token ${tokenId}`, error);
            const hardcoded = featuredEchos[tokenId] || {
              name: name || `Echo #${tokenId}`,
              description: description || "An AI entity containing unique knowledge, ready for exploration.",
              imageUrl: `https://source.unsplash.com/random/800x600?sig=${tokenId}`,
              category: "General"
            };
            
            foundEchos.push({
              tokenId: tokenId,
              owner: creator,
              creator: creator,
              isCreatorActive: false,
              totalQueries: 0,
              pricePerQuery: pricePerQuery,
              ...hardcoded
            });
          }
        }

        setStats({
          totalEchos: tokenIds.length,
          activeUsers: activeUsers,
          totalQueries: totalQueries
        });

      } catch (error) {
        console.error('❌ Failed to load dashboard data:', error);
      }

      setFeaturedEchoList(foundEchos);
      setIsLoading(false);
    };

    loadDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading EchoLink Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="text-center">
            <h1 className="text-5xl lg:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-700 mb-6 animate-fade-in">
              Welcome to EchoLink
            </h1>
            <p className="text-xl lg:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto animate-fade-in-delay">
              The Celestial Library for Web3 Knowledge • Transform your expertise into AI-powered Echo NFTs
            </p>
            
            {!isConnected && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl max-w-md mx-auto animate-slide-up">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">🚀 Get Started</h3>
                <p className="text-gray-600 mb-6">Connect your wallet to explore, create, and interact with Knowledge Echos</p>
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold">
                  Connect Wallet Above →
                </div>
              </div>
            )}

            {isConnected && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl max-w-md mx-auto animate-slide-up">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">🎉 Welcome Back!</h3>
                <p className="text-gray-600 mb-4">Ready to explore the knowledge universe?</p>
                <div className="flex gap-3">
                  <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg font-semibold text-sm">
                    ✅ Connected
                  </div>
                  <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-4 py-2 rounded-lg font-semibold text-sm">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">{stats.totalEchos}</div>
              <div className="text-gray-600 font-medium">Active Echos</div>
              <div className="text-sm text-gray-500 mt-1">Knowledge NFTs on-chain</div>
            </div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in-delay">
            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-600 mb-2">{stats.activeUsers}</div>
              <div className="text-gray-600 font-medium">Active Creators</div>
              <div className="text-sm text-gray-500 mt-1">Echo creators earning</div>
            </div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in-delay-2">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">{stats.totalQueries}</div>
              <div className="text-gray-600 font-medium">Total Queries</div>
              <div className="text-sm text-gray-500 mt-1">Knowledge interactions</div>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Echos Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">🌟 Featured Knowledge Echos</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Discover AI-powered knowledge entities created by experts and enthusiasts from around the world
          </p>
        </div>

        {featuredEchoList.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {featuredEchoList.map((echo, index) => (
              <div 
                key={echo.tokenId} 
                className="animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <EchoCard echo={echo} onSelect={() => {}} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-12 shadow-lg max-w-md mx-auto">
              <div className="text-6xl mb-4">🔮</div>
              <h3 className="text-2xl font-semibold text-gray-700 mb-4">No Echos Yet</h3>
              <p className="text-gray-600 mb-6">Be the first to create a Knowledge Echo NFT!</p>
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold">
                Create Your First Echo
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 text-center group cursor-pointer hover:-translate-y-2" onClick={() => onNavigate('mint')}>
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">🎨</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-3">Create Echo</h3>
            <p className="text-gray-600 mb-6">Transform your knowledge into an AI-powered NFT</p>
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold">
              Start Creating
            </div>
          </div>
          
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 text-center group cursor-pointer hover:-translate-y-2" onClick={() => onNavigate('gallery')}>
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">💬</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-3">Explore Gallery</h3>
            <p className="text-gray-600 mb-6">Browse and chat with available Knowledge Echos</p>
            <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-6 py-3 rounded-lg font-semibold">
              Browse Echos
            </div>
          </div>
          
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 text-center group cursor-pointer hover:-translate-y-2" onClick={() => onNavigate('credits')}>
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">💳</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-3">Manage Credits</h3>
            <p className="text-gray-600 mb-6">Purchase credits for seamless query payments</p>
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-lg font-semibold">
              Buy Credits
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white/40 backdrop-blur-sm py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">✨ Why Choose EchoLink?</h2>
            <p className="text-xl text-gray-600">The future of knowledge sharing is here</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center group">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-6 mb-4 group-hover:scale-105 transition-transform duration-300">
                <div className="text-3xl text-white">🔗</div>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Web3 Native</h3>
              <p className="text-gray-600 text-sm">Built on blockchain for true ownership and decentralization</p>
            </div>
            
            <div className="text-center group">
              <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-6 mb-4 group-hover:scale-105 transition-transform duration-300">
                <div className="text-3xl text-white">🤖</div>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">AI Powered</h3>
              <p className="text-gray-600 text-sm">Advanced AI makes knowledge interactive and accessible</p>
            </div>
            
            <div className="text-center group">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 mb-4 group-hover:scale-105 transition-transform duration-300">
                <div className="text-3xl text-white">💰</div>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Monetizable</h3>
              <p className="text-gray-600 text-sm">Earn from your knowledge through query payments</p>
            </div>
            
            <div className="text-center group">
              <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl p-6 mb-4 group-hover:scale-105 transition-transform duration-300">
                <div className="text-3xl text-white">📁</div>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Multi-Format</h3>
              <p className="text-gray-600 text-sm">Support for text, audio, video, and document files</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
