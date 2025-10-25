import React, { useState, useEffect } from 'react';
import { readContract } from '@wagmi/core';
import axios from 'axios';
import { ECHOLNK_NFT_ADDRESS, ECHO_NFT_ABI, QUERY_PAYMENTS_ADDRESS, QUERY_PAID_TOPIC, CREDITS_USED_TOPIC } from '../config/contracts'; 

// --- Configuration ---
const BLOCKSCOUT_API_BASE = 'https://eth-sepolia.blockscout.com/api';
const PYUSD_DECIMALS = 6;
const PYUSD_RATE_PER_CREDIT = 0.01;
const PROTOCOL_FEE_PERCENT = 0.05; 

// Price Tiers for Visualization
const PRICE_TIERS = [
    { label: "$0.00 - $0.10", max: 0.10, count: 0, color: 'bg-green-100' },
    { label: "$0.11 - $0.50", max: 0.50, count: 0, color: 'bg-yellow-200' },
    { label: "$0.51+", max: Infinity, count: 0, color: 'bg-red-100' }
];

const HIGH_VALUE_THRESHOLD = 0.50;

// --- Interfaces ---
interface EchoStats {
    tokenId: number;
    name: string;
    creator: string;
    totalQueries: number;
    totalPYUSDEarned: number;
    pricePerQuery: number;
}
interface CreatorStats {
    address: string;
    totalEchos: number;
    totalEarnings: number;
    totalQueries: number;
    topEchoId: number | null;
    totalWalletTxs: number;
    highValueEchoRatio: number;
}
interface LogEvent {
    address: string;
    topics: string[];
    data: string; 
    transactionHash: string;
    timeStamp: string; 
}

interface PriceTierData {
    label: string;
    count: number;
    color: string;
    max: number; 
}

// --- Helper Functions ---


const safeParseTokenId = (hexTopic: string): number => {
    try {
        const nonZeroIndex = hexTopic.slice(2).search(/[^0]/);
        
        if (nonZeroIndex === -1) return 0; 
        
        const cleanHex = '0x' + hexTopic.slice(2 + nonZeroIndex);
        
        return Number(BigInt(cleanHex));
    } catch (e) {
        console.error("Failed to safely parse Token ID:", hexTopic, e);
        return 0;
    }
};

const generateBarColor = (tokenId: number): string => {
    const hue = (tokenId * 137) % 360;
    return `hsl(${hue}, 60%, 55%)`; 
};

export const EchoLeaderboard: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<EchoStats[]>([]);
  const [creatorLeaderboard, setCreatorLeaderboard] = useState<CreatorStats[]>([]);
  const [totalMarketValue, setTotalMarketValue] = useState<number>(0);
  const [totalEchosCount, setTotalEchosCount] = useState<number>(0); 
  const [totalQueriesProcessed, setTotalQueriesProcessed] = useState<number>(0);
  const [activeEchosLast7D, setActiveEchosLast7D] = useState<number>(0);
  const [priceDistribution, setPriceDistribution] = useState<PriceTierData[]>([]);
  const [totalProtocolFees, setTotalProtocolFees] = useState<number>(0);
  const [averageRevenuePerEcho, setAverageRevenuePerEcho] = useState<number>(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBlockscoutData = async (params: Record<string, string>): Promise<any> => {
      const query = new URLSearchParams(params).toString();
      const response = await fetch(`${BLOCKSCOUT_API_BASE}?${query}`);
      const data = await response.json();
      return data.result || [];
  };


  const fetchEchoData = async () => {
    console.log("--- Starting fetchEchoData ---");
    try {
      const existingTokenIds = await readContract({
        address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
        abi: ECHO_NFT_ABI,
        functionName: 'getAllTokenIds',
      }) as bigint[];
      
      console.log(`Found ${existingTokenIds.length} minted Token IDs.`);


      const echoMetadataMap = new Map<number, { name: string; creator: string; price: number }>();
      
      // Initialize price distribution calculation
      const currentPriceDistribution: PriceTierData[] = JSON.parse(JSON.stringify(PRICE_TIERS)); // Deep copy

      // Track Echos per creator and their price status for the new metric
      const creatorPriceTracker = new Map<string, { total: number; highValue: number }>();
      
      const uniqueCreators = new Set<string>();

      // --- Fetch data for EACH existing Echo ---
      for (const id of existingTokenIds) {
        const tokenIdNumber = Number(id);
        
        try {
          // Fetch the 8-field tuple data
          const echoData = await readContract({
            address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
            abi: ECHO_NFT_ABI,
            functionName: 'getEchoData',
            args: [id],
          }) as unknown as [string, string, `0x${string}`, bigint, bigint, boolean, boolean, `0x${string}`]; // Corrected tuple structure

          const [name, , creator, pricePerQuery] = echoData;

          // Skip if data is blank/uninitialized (e.g., name is empty)
          if (!name) continue; 

          const price = Number(pricePerQuery) / (10 ** PYUSD_DECIMALS);
          const creatorAddress = creator;
          uniqueCreators.add(creatorAddress);

          echoMetadataMap.set(tokenIdNumber, {
            name: name,
            creator: creatorAddress,
            price: price,
          });

          // Price Distribution Aggregation
          const tier = currentPriceDistribution.find(t => price <= t.max) || currentPriceDistribution[currentPriceDistribution.length - 1];
          tier.count++;

          // Creator Price Tracker Logic
          if (!creatorPriceTracker.has(creatorAddress)) {
              creatorPriceTracker.set(creatorAddress, { total: 0, highValue: 0 });
          }
          const tracker = creatorPriceTracker.get(creatorAddress)!;
          tracker.total++;
          if (price >= HIGH_VALUE_THRESHOLD) {
              tracker.highValue++;
          }
        } catch (error) {
          console.warn(`Skipping Echo ID ${tokenIdNumber} due to fetch error.`, error);
        }
      }
      
      const mintedCount = echoMetadataMap.size;
      setTotalEchosCount(mintedCount);
      setPriceDistribution(currentPriceDistribution); // Set the new state
      console.log(`📊 Loaded ${mintedCount} Echos from contract metadata. Price tiers calculated.`);


      // --- Step 2: Define and Fetch Events from Blockscout ---

      const paymentEvents = await axios.all([
        fetchBlockscoutData({ module: 'logs', action: 'getLogs', address: QUERY_PAYMENTS_ADDRESS, topic0: QUERY_PAID_TOPIC, fromBlock: '0', toBlock: 'latest' }),
        fetchBlockscoutData({ module: 'logs', action: 'getLogs', address: ECHOLNK_NFT_ADDRESS, topic0: CREDITS_USED_TOPIC, fromBlock: '0', toBlock: 'latest' }),
      ]);
      
      const rawQueryPaidEvents: LogEvent[] = paymentEvents[0] || [];
      const rawCreditsUsedEvents: LogEvent[] = paymentEvents[1] || [];
      
      console.log(`✅ Fetched ${rawQueryPaidEvents.length} QueryPaid events and ${rawCreditsUsedEvents.length} CreditsUsed events from Blockscout.`);

      // Initialize Aggregation Map
      const leaderboardMap = new Map<number, EchoStats>();
      const activeEchos = new Set<number>(); // Tracking active Echos
      
      const getOrCreateEntry = (tokenId: number): EchoStats => {
        if (!leaderboardMap.has(tokenId)) {
          const meta = echoMetadataMap.get(tokenId) || { name: `Unknown Echo #${tokenId}`, creator: '0x000...000', price: 0.0 };
          leaderboardMap.set(tokenId, {
            tokenId: tokenId,
            name: meta.name,
            creator: meta.creator,
            totalQueries: 0,
            totalPYUSDEarned: 0,
            pricePerQuery: meta.price,
          });
        }
        return leaderboardMap.get(tokenId)!;
      };

      let grossMarketValue = 0;
      let totalQueries = 0;
      let totalCreatorEarnings = 0; // Temp variable for ARPE calculation
      const oneWeekAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);

      // --- Step 3: Process QueryPaid (Direct PYUSD) Events ---
      rawQueryPaidEvents.forEach((log) => {
        if (log.topics.length < 4) return; 
        
        const tokenId = safeParseTokenId(log.topics[3]);
        const amountWei = log.data && log.data !== '0x' ? BigInt(log.data) : BigInt(0);
        const amountPYUSD = Number(amountWei) / (10 ** PYUSD_DECIMALS); 
        
        grossMarketValue += amountPYUSD;
        totalQueries += 1;
        const timestamp = parseInt(log.timeStamp, 16);
        if (timestamp > oneWeekAgo) {
            activeEchos.add(tokenId);
        }

        if (echoMetadataMap.has(tokenId)) {
          const entry = getOrCreateEntry(tokenId);
          entry.totalQueries += 1;
          const netEarnings = amountPYUSD * (1 - PROTOCOL_FEE_PERCENT);
          entry.totalPYUSDEarned += netEarnings;
          totalCreatorEarnings += netEarnings; 
        }
      });
      
      // --- Step 4: Process CreditsUsed Events ---
      rawCreditsUsedEvents.forEach((log) => {
        if (log.topics.length < 3) return;

        const tokenId = safeParseTokenId(log.topics[2]);
        const creditsUsedWei = log.data && log.data !== '0x' ? BigInt(log.data) : BigInt(0);
        const creditsUsed = Number(creditsUsedWei);
        
        const pyusdValue = creditsUsed * PYUSD_RATE_PER_CREDIT;
        grossMarketValue += pyusdValue; 
        totalQueries += 1;
        const timestamp = parseInt(log.timeStamp, 16);
        if (timestamp > oneWeekAgo) {
            activeEchos.add(tokenId);
        }

        if (echoMetadataMap.has(tokenId)) {
          const entry = getOrCreateEntry(tokenId);
          entry.totalQueries += 1;
          const netEarnings = pyusdValue * (1 - PROTOCOL_FEE_PERCENT);
          entry.totalPYUSDEarned += netEarnings; 
          totalCreatorEarnings += netEarnings;
        }
      });

      // --- Step 5: Finalize Metrics and Sort Echos ---
      const finalLeaderboard = Array.from(leaderboardMap.values())
        .filter(echo => echo.totalQueries > 0)
        .sort((a, b) => b.totalQueries - a.totalQueries); 
      
      // Final Calculations
      const fees = grossMarketValue * PROTOCOL_FEE_PERCENT;
      const arpe = mintedCount > 0 ? totalCreatorEarnings / mintedCount : 0;

      setLeaderboard(finalLeaderboard);
      setTotalMarketValue(grossMarketValue);
      setTotalQueriesProcessed(totalQueries);
      setActiveEchosLast7D(activeEchos.size); 
      setTotalProtocolFees(fees);
      setAverageRevenuePerEcho(arpe);

      // --- Step 6: Create Creator Leaderboard and fetch Tx Data ---
      const creatorMap = new Map<string, CreatorStats>();
      
      finalLeaderboard.forEach(echo => {
          const creatorAddress = echo.creator;

          if (!creatorMap.has(creatorAddress)) {
              // Initialize with calculated High Value Ratio
              const tracker = creatorPriceTracker.get(creatorAddress) || { total: 0, highValue: 0 };
              const ratio = tracker.total > 0 ? (tracker.highValue / tracker.total) * 100 : 0;

              creatorMap.set(creatorAddress, {
                  address: creatorAddress,
                  totalEchos: 0,
                  totalEarnings: 0,
                  totalQueries: 0,
                  topEchoId: null,
                  totalWalletTxs: 0, 
                  highValueEchoRatio: ratio,
              });
          }
          const creatorEntry = creatorMap.get(creatorAddress)!;
          creatorEntry.totalEchos += 1;
          creatorEntry.totalEarnings += echo.totalPYUSDEarned;
          creatorEntry.totalQueries += echo.totalQueries;

          if (creatorEntry.topEchoId === null) {
            creatorEntry.topEchoId = echo.tokenId;
          }
      });

      const finalCreatorLeaderboard = Array.from(creatorMap.values())
        .sort((a, b) => b.totalEarnings - a.totalEarnings);
      
      // --- Step 7: Fetch Transaction Count for Top 5 Creators ---
      console.log("-> Starting Blockscout TX list fetch for top 5 creators...");
      const txPromises = finalCreatorLeaderboard.slice(0, 5).map(creator => {
          console.log(`-> Fetching TX count for creator: ${creator.address.slice(0, 10)}...`);
          return axios.get(`${BLOCKSCOUT_API_BASE}`, { params: {
              module: 'account',
              action: 'txlist',
              address: creator.address,
              startblock: 0,
              endblock: 99999999,
          }}).then(response => {
              const result = response.data.result;
              const txCount = Array.isArray(result) ? result.length : 0;
              console.log(`-> SUCCESS: Fetched ${txCount} TXs for ${creator.address.slice(0, 10)}...`);
              return { address: creator.address, txCount: txCount };
          }).catch((e) => {
              console.error(`-> FAIL: TX count fetch error for ${creator.address.slice(0, 10)}: ${e.message}`);
              return { address: creator.address, txCount: 0 }; 
          });
      });

      const txResults = await axios.all(txPromises);
      
      // Update the final creator leaderboard with wallet Tx data
      const updatedCreatorLeaderboard = finalCreatorLeaderboard.map(creator => {
          const txData = txResults.find(t => t.address === creator.address);
          
          const txCount = txData?.txCount ?? 0;

          return {
              ...creator,
              totalWalletTxs: txCount,
          };
      });
      
      setCreatorLeaderboard(updatedCreatorLeaderboard);
      
    } catch (err) {
      console.error("Blockscout Leaderboard Fetch Error:", err);
      setError("Failed to fetch on-chain analytics data. Please check contract addresses and API URL.");
    } finally {
      setIsLoading(false);
      console.log("--- fetchEchoData Finished ---");
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchEchoData();
  }, []);

  // --- Rendering Helpers ---

  const renderStatCard = (title: string, value: string, icon: string, color: string) => (
    <div className="bg-white p-5 rounded-xl shadow-lg border border-gray-100">
      <div className="flex items-center">
        <span className={`text-3xl p-2 rounded-full ${color}`}>{icon}</span>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-500 uppercase">{title}</p>
          <p className="text-3xl font-extrabold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
  
  const renderPriceDistribution = () => {
    // Determine the total number of Echos to calculate percentages
    const total = priceDistribution.reduce((sum: number, tier: PriceTierData) => sum + tier.count, 0);

    return (
      <div className="h-full">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            ⚖️ Knowledge Pricing Distribution
        </h3>
        <p className="text-xs text-gray-500 mb-6">
            A breakdown of how creators price their specialized knowledge.
        </p>
        
        <div className="space-y-4 pt-2">
            {priceDistribution.map((tier: PriceTierData) => {
                const percentage = total > 0 ? (tier.count / total) * 100 : 0;
                return (
                    <div key={tier.label} className="flex flex-col">
                        <div className="flex justify-between text-sm font-semibold mb-1">
                            <span>{tier.label} ({tier.count} Echos)</span>
                            <span>{percentage.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                                className={`h-3 rounded-full ${tier.color.replace('-100', '-500')} transition-all duration-700`}
                                style={{ width: `${percentage}%` }}
                                title={`${tier.count} Echos`}
                            ></div>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    );
  };
  
  const renderTopEchosChart = () => {
    // Take top 5 Echos
    const topEchos = leaderboard.slice(0, 5);
    const maxQueries = topEchos.length > 0 ? Math.max(...topEchos.map((e: EchoStats) => e.totalQueries)) : 1;

    return (
        <div className="h-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
                📈 Top 5 Echos by Query Volume
            </h3>
            <p className="text-xs text-gray-500 mb-6">
                Most actively used knowledge agents (queries).
            </p>
            <div className="space-y-4 pt-2">
                {topEchos.map((echo: EchoStats) => {
                    const barWidth = (echo.totalQueries / maxQueries) * 100;
                    const barColor = generateBarColor(echo.tokenId);

                    return (
                        <div key={echo.tokenId} className="flex flex-col">
                            <div className="flex justify-between text-sm font-semibold mb-1">
                                <span className="truncate max-w-[70%]">{echo.name}</span>
                                <span className="font-extrabold text-purple-700">{echo.totalQueries.toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-4">
                                <div 
                                    className={`h-4 rounded-full transition-all duration-700 shadow-md`}
                                    style={{ width: `${barWidth}%`, backgroundColor: barColor }}
                                ></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };
  
  const renderCreatorLeaderboard = () => (
    <div className="h-full">
        <h3 className="text-xl font-bold text-gray-900 mb-4">👑 Top Creators by Net Earnings</h3>
        <p className="text-xs text-gray-500 mb-6">
            The top 5 knowledge entrepreneurs based on total verified PYUSD earned.
        </p>
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creator Address</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Echos</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Queries</th>
                        <th className="px-3 py-2 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Earnings</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {creatorLeaderboard.slice(0, 5).map((creator: CreatorStats, index: number) => (
                        <tr key={creator.address} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-center">
                                {index + 1}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm font-mono text-gray-700 truncate max-w-xs" title={creator.address}>
                                {creator.address.slice(0, 6)}...{creator.address.slice(-4)}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-center text-sm text-purple-700 font-semibold">
                                {creator.totalEchos}
                            </td>
                             <td className="px-3 py-3 whitespace-nowrap text-center text-sm text-purple-700 font-semibold">
                                {creator.totalQueries.toLocaleString()}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-center text-md font-extrabold text-green-700">
                                ${creator.totalEarnings.toFixed(2)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );


  const renderLeaderboardTable = () => {
    if (isLoading) {
      return (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-3 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-lg">Aggregating queries and earnings from **Blockscout**...</p>
        </div>
      );
    }

    if (error) {
      return <div className="text-center text-red-600 bg-red-50 p-6 rounded-lg">{error}</div>;
    }

    if (leaderboard.length === 0) {
      return (
        <div className="text-center text-gray-500 bg-gray-50 p-10 rounded-lg">
          No Echos have received paid queries yet. Be the first to chat!
        </div>
      );
    }

    // Echo Table
    return (
      <div className="overflow-x-auto">
        <h3 className="text-2xl font-bold text-gray-900 mb-4 p-4 border-b">📊 Top Performing Knowledge Echos</h3>
        
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Echo Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creator</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                Queries
              </th>
              <th className="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                Earnings
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {leaderboard.map((echo: EchoStats, index: number) => (
              <tr key={echo.tokenId} className={index < 3 ? 'bg-yellow-50/50 hover:bg-yellow-100/50' : 'hover:bg-gray-50'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {index === 0 && <span className="text-3xl">🥇</span>}
                  {index === 1 && <span className="text-2xl">🥈</span>}
                  {index === 2 && <span className="text-xl">🥉</span>}
                  {index >= 3 && <span className="text-lg text-gray-500 ml-2">{index + 1}</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{echo.name} <span className="text-gray-400 font-normal text-xs">(# {echo.tokenId})</span></td>
                <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-600 truncate max-w-xs">{echo.creator.slice(0, 6)}...{echo.creator.slice(-4)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-lg font-extrabold text-purple-700">
                  {echo.totalQueries.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-lg font-extrabold text-green-700">
                  ${echo.totalPYUSDEarned.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">${echo.pricePerQuery.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-12">
          {/* Header Section */}
          <div className="text-center mb-12 animate-fade-in">
            <h2 className="text-5xl lg:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-700 mb-4">
              🏆 Echo Marketplace Leaderboard
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Rankings are fully verified by on-chain transaction data retrieved directly from Blockscout's API
            </p>
          </div>

          {/* Protocol Overview Section */}
          <div className="mb-8 animate-fade-in-delay">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200/50">
              <div className="flex items-center mb-6">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                  🌐
                </div>
                <h3 className="text-2xl font-semibold text-gray-800">Protocol Overview</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {renderStatCard("Total Echos Minted", `${totalEchosCount}`, "🧠", "text-indigo-600 bg-indigo-50")}
                {renderStatCard("Queries Processed", `${totalQueriesProcessed.toLocaleString()}`, "❓", "text-purple-600 bg-purple-50")}
                {renderStatCard("Market Value Transacted", `$${totalMarketValue.toFixed(2)}`, "💰", "text-green-600 bg-green-50")}
                {renderStatCard("Active Echos (7D)", `${activeEchosLast7D}`, "⚡", "text-yellow-600 bg-yellow-50")}
              </div>
            </div>
          </div>
          
          {/* Financial Efficiency Section */}
          <div className="mb-8 animate-fade-in-delay-2">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200/50">
              <div className="flex items-center mb-6">
                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                  📈
                </div>
                <h3 className="text-2xl font-semibold text-gray-800">Financial Efficiency</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderStatCard("Protocol Fees Collected", `$${totalProtocolFees.toFixed(2)}`, "🧾", "text-red-600 bg-red-50")}
                {renderStatCard("Avg Revenue Per Echo", `$${averageRevenuePerEcho.toFixed(2)}`, "📈", "text-cyan-600 bg-cyan-50")}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="mb-8 animate-fade-in-delay-2">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-12 shadow-lg border border-gray-200/50 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Aggregating queries and earnings from Blockscout...</h3>
                <p className="text-gray-600">This may take a few moments...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 animate-fade-in-delay-2">
                {priceDistribution.length > 0 && (
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200/50">
                    {renderPriceDistribution()}
                  </div>
                )}
                {leaderboard.length > 0 && (
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200/50">
                    {renderTopEchosChart()}
                  </div>
                )}
              </div>

              {/* Creator Leaderboard */}
              {creatorLeaderboard.length > 0 && (
                <div className="mb-8 animate-fade-in-delay-2">
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200/50">
                    {renderCreatorLeaderboard()}
                  </div>
                </div>
              )}

          {/* Echo Leaderboard Table */}
          <div className="animate-fade-in-delay-2">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50">
              {renderLeaderboardTable()}
            </div>
          </div>
        </>
      )}
    </div>
  </div>
);
};
