import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { readContract } from '@wagmi/core';
import { EchoCard, EchoInfo } from './EchoCard';
import { ECHOLNK_NFT_ADDRESS, ECHO_NFT_ABI, QUERY_PAID_TOPIC, CREDITS_USED_TOPIC, QUERY_PAYMENTS_ADDRESS} from '../config/contracts';

const API_BASE_URL = 'https://eth-sepolia.blockscout.com/api'; // Base RPC API URL
const ACTIVITY_THRESHOLD = 0;

interface LogEvent {
    topics: string[];
    data: string;
    timeStamp: string;
}

const safeParseTokenId = (hexTopic: string): number => {
    try {
        const nonZeroIndex = hexTopic.slice(2).search(/[^0]/);
        if (nonZeroIndex === -1) return 0;
        const cleanHex = '0x' + hexTopic.slice(2 + nonZeroIndex);
        return Number(BigInt(cleanHex));
    } catch (e) {
        return 0;
    }
};

const fetchBlockscoutData = async (params: Record<string, string>): Promise<any> => {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}?${query}`);
    const data = await response.json();
    return data.result || [];
};

const fetchEchoQueryStats = async (tokenIdNumber: number) => {
    const [queryPaidLogs, creditsUsedLogs] = await Promise.all([
          fetchBlockscoutData({
            module: 'logs',
            action: 'getLogs',
            address: QUERY_PAYMENTS_ADDRESS,
            topic0: QUERY_PAID_TOPIC,
            fromBlock: '0', 
            toBlock: 'latest'
          }),
          // 2. CreditsUsed: Logs from the EchoNFT contract
          fetchBlockscoutData({
            module: 'logs',
            action: 'getLogs',
            address: ECHOLNK_NFT_ADDRESS,
            topic0: CREDITS_USED_TOPIC,
            fromBlock: '0', 
            toBlock: 'latest', 
          }),
    ]);

    let totalQueries = 0;

    const processLogs = (logs: LogEvent[], isCredit: boolean) => {
        logs.forEach(log => {
            const tokenTopicIndex = isCredit ? 2 : 3;
            
            if (log.topics.length > tokenTopicIndex) {
                const logTokenId = safeParseTokenId(log.topics[tokenTopicIndex]);
                
                if (logTokenId === tokenIdNumber) {
                    totalQueries++;
                }
            }
        });
    };

    processLogs(queryPaidLogs, false);
    processLogs(creditsUsedLogs, true);

    return { totalQueries };
};

// --- Dashboard Component Definitions ---

interface EchoDashboardProps {
  onNavigate: (tab: 'dashboard' | 'mint' | 'gallery' | 'credits' | 'leaderboard') => void;
}

export const EchoDashboard: React.FC<EchoDashboardProps> = ({ onNavigate }) => {
  const [featuredEchoList, setFeaturedEchoList] = useState<EchoInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEchos: 0,
    activeCreators: 0, 
    totalQueries: 0
  });
  const { address, isConnected } = useAccount();

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      const foundEchos: EchoInfo[] = [];

      try {
        let aggregatedTotalQueries = 0;
        let activeCreatorsCount = 0;
        const processedCreators = new Set<string>();

        // Get all actual token IDs that exist (same as EchoGallery)
        const allTokenIds = await readContract({
          address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
          abi: ECHO_NFT_ABI,
          functionName: 'getAllTokenIds',
        }) as bigint[];

        console.log(`🔍 Dashboard: Found ${allTokenIds.length} actual token IDs:`, allTokenIds.map(id => Number(id)));
        
        // Process featured echos (limit to 4 for dashboard)
        const featuredTokenIds = allTokenIds.slice(0, 4); // Take first 4 actual token IDs
        
        for (const tokenIdBigInt of featuredTokenIds) {
          const tokenId = Number(tokenIdBigInt);
          try {
            // Get individual Echo data
            const echoData = await readContract({
              address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
              abi: ECHO_NFT_ABI,
              functionName: 'getEchoData',
              args: [BigInt(tokenId)],
            }) as unknown as [string, string, `0x${string}`, bigint, boolean, bigint, boolean, `0x${string}`];

            const [name, description, creator, pricePerQuery, isActive, purchasePrice, isForSale, owner] = echoData;

            const { totalQueries } = await fetchEchoQueryStats(tokenId);

            // Aggregate total queries for the dashboard stat
            aggregatedTotalQueries += totalQueries;
            
            // Determine activity for this creator and update global stats
            const isCreatorActive = totalQueries > ACTIVITY_THRESHOLD;
            if (isCreatorActive && !processedCreators.has(creator)) {
                activeCreatorsCount++;
                processedCreators.add(creator);
            }

            // Use actual Echo data instead of hardcoded data
            foundEchos.push({
              tokenId: tokenId,
              owner: owner as string,
              creator: creator,
              isCreatorActive: isCreatorActive,
              totalQueries: totalQueries, 
              pricePerQuery: pricePerQuery,
              purchasePrice: purchasePrice,
              isForSale: isForSale,
              isOwned: false, 
              name: name || `Echo #${tokenId}`,
              description: description || "An AI entity containing unique knowledge, ready for exploration.",
              imageUrl: `https://source.unsplash.com/random/800x600?sig=${tokenId}`,
              category: "General"
            });

          } catch (error) {
            console.warn(`Failed to fetch data for token ${tokenId}`, error);
            continue;
          }
        }

        setStats({
          totalEchos: allTokenIds.length,
          activeCreators: activeCreatorsCount,
          totalQueries: aggregatedTotalQueries
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
               <img
                 src="/echolink_logo.png"
                 alt="EchoLink Logo"
                 className="h-20 w-20 object-contain mx-auto mb-4 animate-pulse brightness-110 contrast-110"
               />
          <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-indigo-600 mx-auto mb-4"></div>
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
            <div className="flex justify-center items-center mb-6">
           <img
             src="/echolink_logo.png"
             alt="EchoLink Logo"
             className="h-24 w-24 object-contain mr-6 animate-fade-in drop-shadow-2xl hover:drop-shadow-3xl transition-all duration-500 hover:scale-110 brightness-110 contrast-110"
           />
              <h1 className="text-5xl lg:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-700 animate-fade-in">
                EchoLink
              </h1>
            </div>
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
                <div className="flex gap-3 justify-center">
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
              <div className="text-gray-600 font-medium">Total Echos</div>
              <div className="text-sm text-gray-500 mt-1">Knowledge NFTs on-chain</div>
            </div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in-delay">
            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-600 mb-2">{stats.activeCreators}</div>
              <div className="text-gray-600 font-medium">Active Creators</div>
              <div className="text-sm text-gray-500 mt-1">Unique creators earning</div>
            </div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in-delay-2">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">{stats.totalQueries}</div>
              <div className="text-gray-600 font-medium">Total Queries</div>
              <div className="text-sm text-gray-500 mt-1">Queries processed via platform</div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-stretch">
            {featuredEchoList.map((echo, index) => (
              <div 
                key={echo.tokenId} 
                className="animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <EchoCard echo={echo} onSelect={(tokenId) => onNavigate('gallery')} />
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
