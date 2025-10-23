import React, { useState, useEffect } from 'react';
import { readContract } from '@wagmi/core';
import axios from 'axios';
import { ECHOLNK_NFT_ADDRESS, ECHO_NFT_ABI, QUERY_PAYMENTS_ADDRESS } from '../config/contracts'; 
import { useAccount } from 'wagmi';

// --- Configuration ---
const BLOCKSCOUT_API_BASE = 'https://eth-sepolia.blockscout.com/api';
const PYUSD_DECIMALS = 6;
const PYUSD_TOKEN_ADDRESS = '0xCaC524BcA292aaade2df8a05cC58F0a65B1B3bB9'; 
const PYUSD_RATE_PER_CREDIT = 0.01;
const PROTOCOL_FEE_PERCENT = 0.05; // 5% fee

// Price Tiers for Visualization
const PRICE_TIERS = [
    { label: "$0.00 - $0.10", max: 0.10, count: 0, color: 'bg-green-100' },
    { label: "$0.11 - $0.50", max: 0.50, count: 0, color: 'bg-yellow-100' },
    { label: "$0.51+", max: Infinity, count: 0, color: 'bg-red-100' },
];

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
    topEchoId: number | null;
}
interface LogEvent {
    address: string;
    topics: string[];
    data: string; // Hex string of non-indexed data
    transactionHash: string;
    timeStamp: string; // FIX: Added timeStamp property
}
// FIX: Added 'max' property to PriceTierData interface
interface PriceTierData {
    label: string;
    count: number;
    color: string;
    max: number; 
}

// --- Helper Functions ---

/**
 * Safely converts a padded 32-byte hex topic string (uint256) into a safe JavaScript number (integer).
 * This is the fix for the scientific notation error.
 */
const safeParseTokenId = (hexTopic: string): number => {
    try {
        // Find the index where the non-zero digits start (after '0x' and leading zeros)
        const nonZeroIndex = hexTopic.slice(2).search(/[^0]/);
        
        if (nonZeroIndex === -1) return 0; // Topic is all zeros
        
        // Extract the non-padded portion, or fallback to the whole string if short
        const cleanHex = '0x' + hexTopic.slice(2 + nonZeroIndex);
        
        // Use BigInt for the large hex, then convert to Number for small IDs
        // This avoids corruption that happens when parsing the fully padded string
        return Number(BigInt(cleanHex));
    } catch (e) {
        console.error("Failed to safely parse Token ID:", hexTopic, e);
        return 0;
    }
};

/**
 * Generates a color based on the Token ID for visual distinction in charts.
 */
const generateBarColor = (tokenId: number): string => {
    const hue = (tokenId * 137) % 360;
    return `hsl(${hue}, 60%, 55%)`; // A distinct, readable color
};


// --- Component ---
export const EchoLeaderboard: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<EchoStats[]>([]);
  const [creatorLeaderboard, setCreatorLeaderboard] = useState<CreatorStats[]>([]);
  const [totalMarketValue, setTotalMarketValue] = useState<number>(0);
  const [totalEchosCount, setTotalEchosCount] = useState<number>(0); 
  const [totalQueriesProcessed, setTotalQueriesProcessed] = useState<number>(0); // NEW STATE for total queries
  const [activeEchosLast7D, setActiveEchosLast7D] = useState<number>(0); // NEW STATE for activity
  const [priceDistribution, setPriceDistribution] = useState<PriceTierData[]>([]); // NEW STATE for distribution
  
  // NEW STATES for financial metrics
  const [totalProtocolFees, setTotalProtocolFees] = useState<number>(0);
  const [averageRevenuePerEcho, setAverageRevenuePerEcho] = useState<number>(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEchoData = async () => {
    console.log("--- Starting fetchEchoData ---");
    try {
      // --- Step 1: Get ALL Echo Metadata from Smart Contract (Wagmi) ---
      const allEchoesData = await readContract({
        address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
        abi: ECHO_NFT_ABI,
        functionName: 'getAllEchoes',
      }) as [
        bigint[], string[], string[], `0x${string}`[], bigint[], boolean[]
      ];

      const [tokenIds, names, descriptions, creators, pricesPerQuery] = allEchoesData;
      const echoMetadataMap = new Map<number, { name: string; creator: string; price: number }>();
      
      // Initialize price distribution calculation
      const currentPriceDistribution: PriceTierData[] = JSON.parse(JSON.stringify(PRICE_TIERS)); // Deep copy

      tokenIds.forEach((id, i) => {
        const tokenIdNumber = Number(id);
        const price = Number(pricesPerQuery[i]) / (10 ** PYUSD_DECIMALS);

        echoMetadataMap.set(tokenIdNumber, {
          name: names[i],
          creator: creators[i],
          price: price,
        });

        // Price Distribution Aggregation
        const tier = currentPriceDistribution.find(t => price <= t.max) || currentPriceDistribution[currentPriceDistribution.length - 1];
        tier.count++;
      });
      
      const mintedCount = echoMetadataMap.size;
      setTotalEchosCount(mintedCount);
      setPriceDistribution(currentPriceDistribution); // Set the new state
      console.log(`📊 Loaded ${mintedCount} Echos from contract metadata. Price tiers calculated.`);


      // --- Step 2: Define and Fetch Events from Blockscout ---
      
      const queryPaidTopic = '0xad43474671daf07280e68edd7b27b2f40c4c24ea677afd418a3a407fa27f4058'; 
      const creditsUsedTopic = '0x530c3167195b45c3635391c530663152a488a071f1e737194e9f758417c800c1'; 

      const paymentEvents = await axios.all([
        axios.get(`${BLOCKSCOUT_API_BASE}`, { params: { module: 'logs', action: 'getLogs', address: QUERY_PAYMENTS_ADDRESS, topic0: queryPaidTopic, fromBlock: 0, toBlock: 'latest', }}),
        axios.get(`${BLOCKSCOUT_API_BASE}`, { params: { module: 'logs', action: 'getLogs', address: ECHOLNK_NFT_ADDRESS, topic0: creditsUsedTopic, fromBlock: 0, toBlock: 'latest', }}),
      ]);
      
      const rawQueryPaidEvents: LogEvent[] = paymentEvents[0].data.result || [];
      const rawCreditsUsedEvents: LogEvent[] = paymentEvents[1].data.result || [];
      
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
        
        // Activity Tracking (FIX: timeStamp property is now correctly typed)
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

        // Activity Tracking (FIX: timeStamp property is now correctly typed)
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
      setTotalProtocolFees(fees); // NEW STAT
      setAverageRevenuePerEcho(arpe); // NEW STAT

      // --- Step 6: Create Creator Leaderboard ---
      const creatorMap = new Map<string, CreatorStats>();
      
      finalLeaderboard.forEach(echo => {
          const creatorAddress = echo.creator;

          if (!creatorMap.has(creatorAddress)) {
              creatorMap.set(creatorAddress, {
                  address: creatorAddress,
                  totalEchos: 0,
                  totalEarnings: 0,
                  topEchoId: null,
              });
          }
          const creatorEntry = creatorMap.get(creatorAddress)!;
          creatorEntry.totalEchos += 1;
          creatorEntry.totalEarnings += echo.totalPYUSDEarned;

          if (creatorEntry.topEchoId === null) {
            creatorEntry.topEchoId = echo.tokenId;
          }
      });

      const finalCreatorLeaderboard = Array.from(creatorMap.values())
        .sort((a, b) => b.totalEarnings - a.totalEarnings);
      
      setCreatorLeaderboard(finalCreatorLeaderboard);
      
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
    const total = priceDistribution.reduce((sum, tier) => sum + tier.count, 0);

    return (
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 h-full">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            ⚖️ Knowledge Pricing Distribution
        </h3>
        <p className="text-xs text-gray-500 mb-6">
            A breakdown of how creators price their specialized knowledge.
        </p>
        
        <div className="space-y-4 pt-2">
            {priceDistribution.map((tier) => {
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
    const maxQueries = topEchos.length > 0 ? Math.max(...topEchos.map(e => e.totalQueries)) : 1;

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 h-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
                📈 Top 5 Echos by Query Volume
            </h3>
            <p className="text-xs text-gray-500 mb-6">
                Most actively used knowledge agents (queries).
            </p>
            <div className="space-y-4 pt-2">
                {topEchos.map((echo) => {
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
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 h-full">
        <h3 className="text-xl font-bold text-gray-900 mb-4">👑 Top Creators by Net Earnings</h3>
        <p className="text-xs text-gray-500 mb-6">
            The top 5 knowledge entrepreneurs based on total verified PYUSD earned.
        </p>
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                        <th className-="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creator Address</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Echos</th>
                        <th className="px-3 py-2 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Earnings</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {creatorLeaderboard.slice(0, 5).map((creator, index) => (
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
      <div className="overflow-x-auto mt-8 bg-white rounded-xl shadow-lg">
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
            {leaderboard.map((echo, index) => (
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
    <div className="p-6">
      <h2 className="text-3xl font-extrabold text-gray-900 mb-2 flex items-center">
        🏆 Echo Marketplace Leaderboard
      </h2>
      <p className="mb-6 text-lg text-gray-600 flex items-center">
        Rankings are **fully verified** by on-chain transaction data retrieved directly from **Blockscout's API**.
        
      </p>

      {/* --- SECTION 1: CORE MARKET STATS --- */}
      <h3 className="text-2xl font-bold text-gray-900 mb-4 border-b pb-2">🌐 Protocol Overview</h3>
      <div className="grid grid-cols-4 gap-6 mb-8">
        {renderStatCard("Total Echos Minted", `${totalEchosCount}`, "🧠", "text-indigo-600 bg-indigo-50")}
        {renderStatCard("Queries Processed", `${totalQueriesProcessed.toLocaleString()}`, "❓", "text-purple-600 bg-purple-50")}
        {renderStatCard("Market Value Transacted", `$${totalMarketValue.toFixed(2)}`, "💰", "text-green-600 bg-green-50")}
        {renderStatCard("Active Echos (7D)", `${activeEchosLast7D}`, "⚡", "text-yellow-600 bg-yellow-50")}
      </div>
      
      {/* --- NEW SECTION 1B: FINANCIAL EFFICIENCY (2-column layout) --- */}
      <h3 className="text-2xl font-bold text-gray-900 mb-4 border-b pb-2">📈 Financial Efficiency</h3>
      <div className="grid grid-cols-4 gap-6 mb-8">
        {renderStatCard("Protocol Fees Collected", `$${totalProtocolFees.toFixed(2)}`, "🧾", "text-red-600 bg-red-50")}
        {renderStatCard("Avg Revenue Per Echo", `$${averageRevenuePerEcho.toFixed(2)}`, "📈", "text-cyan-600 bg-cyan-50")}
      </div>

      {isLoading ? renderLeaderboardTable() : (
        <div className="grid grid-cols-1 gap-6"> {/* Unified 1-column grid */}
            
            {/* Row 1: Charts (2 columns) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {priceDistribution.length > 0 && renderPriceDistribution()}
                {leaderboard.length > 0 && renderTopEchosChart()}
            </div>

            {/* Row 2: Creator Leaderboard (Full Width) */}
            <div className="grid grid-cols-1">
                {creatorLeaderboard.length > 0 && renderCreatorLeaderboard()}
            </div>
        </div>
      )}
      
      {/* --- SECTION 2: ECHO LEADERBOARD TABLE --- */}
      {!isLoading && renderLeaderboardTable()}

    </div>
  );
};
