import React, { useState, useEffect } from 'react';
import { readContract } from '@wagmi/core';
import axios from 'axios';
import { ECHOLNK_NFT_ADDRESS, ECHO_NFT_ABI, QUERY_PAYMENTS_ADDRESS, QUERY_PAID_TOPIC, CREDITS_USED_TOPIC } from '../config/contracts'; 
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

// --- Configuration ---
const BLOCKSCOUT_API_BASE = 'https://eth-sepolia.blockscout.com/api';
const PYUSD_DECIMALS = 6;
const PYUSD_RATE_PER_CREDIT = 0.01;
const PROTOCOL_FEE_PERCENT = 0.05; 

const CHART_COLORS = {
  purple: '#8b5cf6', // purple-500
  blue: '#3b82f6',   // blue-500
  green: '#10b981', // emerald-500
  indigo: '#6366f1', // indigo-500
  yellow: '#eab308', // yellow-500
  pink: '#ec4899',   // pink-500
};

// Series for charts like Top 5
const CHART_COLORS_SERIES = [
  CHART_COLORS.purple,
  CHART_COLORS.blue,
  CHART_COLORS.green,
  CHART_COLORS.indigo,
  CHART_COLORS.pink,
];

// Price Tiers ---
const PRICE_TIERS = [
    { label: "$0.00 - $0.10", max: 0.10, count: 0, color: CHART_COLORS.blue },
    { label: "$0.11 - $0.25", max: 0.25, count: 0, color: CHART_COLORS.yellow },
    { label: "$0.26+", max: Infinity, count: 0, color: CHART_COLORS.pink }
];

const HIGH_VALUE_THRESHOLD = 0.50;

// Verified Event Topic Hashe
const ECHO_PURCHASED_TOPIC = '0x312fce23d69c223016f5bdfd33529fd7dfb0507bfdfb2ba2a61ea7af70f474a3';


const MARKET_ACCESS_COLORS = {
  available: CHART_COLORS.pink,
  forSale: CHART_COLORS.blue,
  purchased: CHART_COLORS.purple,
};

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
interface ContentAccessData {
  purchased: number;
  forSale: number;
  available: number;
}
interface TimeSeriesData {
  date: string;
  queries: number | null;
  volume: number | null;
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

// Helper to format date from timestamp
const getFormattedDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000); 
    return date.toISOString().split('T')[0]; 
};

// Helper for Recharts Tooltips
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-sm p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="text-sm font-bold text-gray-900">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={`item-${index}`} style={{ color: entry.color }} className="text-sm font-medium">
            {`${entry.name}: ${entry.value === null ? 0 : entry.value.toLocaleString()}`}
            {entry.name === 'Volume (PYUSD)' && '$'}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const ChartPlaceholder = ({ message }: { message: string }) => (
  <div className="flex-grow min-h-[250px] flex items-center justify-center text-center text-gray-500 bg-gray-50/50 rounded-lg p-4">
    <p>{message}</p>
  </div>
);


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
  const [totalSecondarySales, setTotalSecondarySales] = useState<number>(0);
  const [marketAccessData, setMarketAccessData] = useState<ContentAccessData>({ purchased: 0, forSale: 0, available: 0 });
  const [totalEchosPurchased, setTotalEchosPurchased] = useState<number>(0);
  const [marketLiquidityRatio, setMarketLiquidityRatio] = useState<string>("0%");
  const [queryActivity, setQueryActivity] = useState<TimeSeriesData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
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
    setIsLoading(true);
    setError(null);
    try {
      // Step 1: Get ALL Existing Token IDs
      const existingTokenIds = await readContract({
        address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
        abi: ECHO_NFT_ABI,
        functionName: 'getAllTokenIds', 
      }) as bigint[];
      
      console.log(`Found ${existingTokenIds.length} minted Token IDs.`);

      const echoMetadataMap = new Map<number, { name: string; creator: string; price: number }>();
      const currentPriceDistribution: PriceTierData[] = JSON.parse(JSON.stringify(PRICE_TIERS)); 
      const creatorPriceTracker = new Map<string, { total: number; highValue: number }>();
      const uniqueCreators = new Set<string>();
      
      let countPurchased = 0, countForSale = 0, countAvailableForQuery = 0; 

      for (const id of existingTokenIds) {
        const tokenIdNumber = Number(id);
        
        try {
          const echoData = await readContract({
            address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
            abi: ECHO_NFT_ABI,
            functionName: 'getEchoData',
            args: [id],
          }) as unknown as [string, string, `0x${string}`, bigint, bigint, boolean, boolean, `0x${string}`]; 

          const [name, , creator, pricePerQuery, , isActive, isForSale, owner] = echoData; 
          if (!name) continue; 

          const price = Number(pricePerQuery) / (10 ** PYUSD_DECIMALS);
          const creatorAddress = creator;
          uniqueCreators.add(creatorAddress);

          echoMetadataMap.set(tokenIdNumber, { name, creator: creatorAddress, price });
          
          if (owner !== creatorAddress) countPurchased++;
          else if (isForSale) countForSale++;
          if (isActive && owner === creatorAddress) countAvailableForQuery++;

          const tier = currentPriceDistribution.find(t => price <= t.max) || currentPriceDistribution[currentPriceDistribution.length - 1];
          tier.count++;

          if (!creatorPriceTracker.has(creatorAddress)) {
              creatorPriceTracker.set(creatorAddress, { total: 0, highValue: 0 });
          }
          const tracker = creatorPriceTracker.get(creatorAddress)!;
          tracker.total++;
          if (price >= HIGH_VALUE_THRESHOLD) tracker.highValue++;
        } catch (error) {
          console.warn(`Skipping Echo ID ${tokenIdNumber} due to fetch error.`, error);
        }
      }
      
      const mintedCount = echoMetadataMap.size;
      setTotalEchosCount(mintedCount);
      setPriceDistribution(currentPriceDistribution); 
      setMarketAccessData({ purchased: countPurchased, forSale: countForSale, available: countAvailableForQuery });
      const liquidityRatio = mintedCount > 0 ? (countForSale / mintedCount) * 100 : 0;
      setMarketLiquidityRatio(liquidityRatio.toFixed(1) + '%');
      setTotalEchosPurchased(countPurchased); 

      console.log(`📊 Loaded ${mintedCount} Echos from contract metadata.`);

      // Step 2: Fetch Events
      const paymentEvents = await axios.all([
        axios.get(`${BLOCKSCOUT_API_BASE}?module=logs&action=getLogs&address=${QUERY_PAYMENTS_ADDRESS}&topic0=${QUERY_PAID_TOPIC}&fromBlock=0&toBlock=latest`),
        axios.get(`${BLOCKSCOUT_API_BASE}?module=logs&action=getLogs&address=${ECHOLNK_NFT_ADDRESS}&topic0=${CREDITS_USED_TOPIC}&fromBlock=0&toBlock=latest`),
        axios.get(`${BLOCKSCOUT_API_BASE}?module=logs&action=getLogs&address=${ECHOLNK_NFT_ADDRESS}&topic0=${ECHO_PURCHASED_TOPIC}&fromBlock=0&toBlock=latest`),
      ]);
      
      const rawQueryPaidEvents: LogEvent[] = paymentEvents[0].data.result || [];
      const rawCreditsUsedEvents: LogEvent[] = paymentEvents[1].data.result || [];
      const rawEchoPurchasedEvents: LogEvent[] = paymentEvents[2].data.result || []; 
      
      console.log(`✅ Fetched QueryPaid: ${rawQueryPaidEvents.length}, CreditsUsed: ${rawCreditsUsedEvents.length}, Purchased: ${rawEchoPurchasedEvents.length}`);

      // Initialize Aggregation Maps
      const leaderboardMap = new Map<number, EchoStats>();
      const activeEchos = new Set<number>(); 
      const dailyActivityMap = new Map<string, { queries: number, volume: number }>();
      
      const getOrCreateEntry = (tokenId: number): EchoStats => {
        if (!leaderboardMap.has(tokenId)) {
          const meta = echoMetadataMap.get(tokenId) || { name: `Unknown Echo #${tokenId}`, creator: '0x000...000', price: 0.0 };
          leaderboardMap.set(tokenId, {
            tokenId: tokenId, name: meta.name, creator: meta.creator, totalQueries: 0, totalPYUSDEarned: 0, pricePerQuery: meta.price,
          });
        }
        return leaderboardMap.get(tokenId)!;
      };

      let grossMarketValue = 0, totalQueries = 0, totalCreatorEarnings = 0, secondarySalesVolume = 0; 
      const oneWeekAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);

      // Step 3: Process QueryPaid Events
      rawQueryPaidEvents.forEach((log) => {
        if (log.topics.length < 4) return; 
        
        const tokenId = safeParseTokenId(log.topics[3]);
        const amountWei = log.data && log.data !== '0x' ? BigInt(log.data) : BigInt(0);
        const amountPYUSD = Number(amountWei) / (10 ** PYUSD_DECIMALS); 
        const timestamp = parseInt(log.timeStamp, 16);
        const dateStr = getFormattedDate(timestamp);

        grossMarketValue += amountPYUSD;
        totalQueries += 1;
        if (timestamp > oneWeekAgo) activeEchos.add(tokenId);

        const dayData = dailyActivityMap.get(dateStr) || { queries: 0, volume: 0 };
        dayData.queries += 1;
        dayData.volume += amountPYUSD;
        dailyActivityMap.set(dateStr, dayData);

        if (echoMetadataMap.has(tokenId)) {
          const entry = getOrCreateEntry(tokenId);
          entry.totalQueries += 1;
          const netEarnings = amountPYUSD * (1 - PROTOCOL_FEE_PERCENT);
          entry.totalPYUSDEarned += netEarnings;
          totalCreatorEarnings += netEarnings; 
        }
      });
      
      // Step 4: Process CreditsUsed Events
      rawCreditsUsedEvents.forEach((log) => {
        if (log.topics.length < 3) return;

        const tokenId = safeParseTokenId(log.topics[2]);
        const creditsUsedWei = log.data && log.data !== '0x' ? BigInt(log.data) : BigInt(0);
        const creditsUsed = Number(creditsUsedWei);
        const timestamp = parseInt(log.timeStamp, 16);
        const dateStr = getFormattedDate(timestamp);
        
        const pyusdValue = creditsUsed * PYUSD_RATE_PER_CREDIT;
        grossMarketValue += pyusdValue; 
        totalQueries += 1;
        if (timestamp > oneWeekAgo) activeEchos.add(tokenId);

        const dayData = dailyActivityMap.get(dateStr) || { queries: 0, volume: 0 };
        dayData.queries += 1;
        dayData.volume += pyusdValue;
        dailyActivityMap.set(dateStr, dayData);

        if (echoMetadataMap.has(tokenId)) {
          const entry = getOrCreateEntry(tokenId);
          entry.totalQueries += 1;
          const netEarnings = pyusdValue * (1 - PROTOCOL_FEE_PERCENT);
          entry.totalPYUSDEarned += netEarnings; 
          totalCreatorEarnings += netEarnings;
        }
      });
      
      // Step 4b: Process EchoPurchased Events
      rawEchoPurchasedEvents.forEach((log) => {
          if (log.topics.length < 4) return;
          const purchasePriceWei = log.data && log.data !== '0x' ? BigInt(log.data) : BigInt(0);
          const purchasePricePYUSD = Number(purchasePriceWei) / (10 ** PYUSD_DECIMALS);
          
          secondarySalesVolume += purchasePricePYUSD; 
          grossMarketValue += purchasePricePYUSD; 
      });


      // Step 5: Finalize Metrics
      const finalLeaderboard = Array.from(leaderboardMap.values())
        .filter(echo => echo.totalQueries > 0)
        .sort((a, b) => b.totalQueries - a.totalQueries); 
      
      const fees = grossMarketValue * PROTOCOL_FEE_PERCENT;
      const arpe = mintedCount > 0 ? totalCreatorEarnings / mintedCount : 0;

      setLeaderboard(finalLeaderboard);
      setTotalMarketValue(grossMarketValue);
      setTotalQueriesProcessed(totalQueries);
      setActiveEchosLast7D(activeEchos.size); 
      setTotalProtocolFees(fees);
      setAverageRevenuePerEcho(arpe);
      setTotalSecondarySales(secondarySalesVolume); 

      // Process Time-Series Data
      const sortedActivity: TimeSeriesData[] = Array.from(dailyActivityMap.entries())
        .map(([date, data]) => ({
            date,
            queries: data.queries,
            volume: parseFloat(data.volume.toFixed(2))
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      let finalActivityData = sortedActivity;
      if (sortedActivity.length > 1) {
        const filledActivity: TimeSeriesData[] = [];
        const activityMap = new Map(sortedActivity.map(data => [data.date, data]));
        
        const parseDateUTC = (dateStr: string): Date => {
          const [year, month, day] = dateStr.split('-').map(Number);
          return new Date(Date.UTC(year, month - 1, day));
        };
        
        const startDate = parseDateUTC(sortedActivity[0].date);
        const endDate = parseDateUTC(sortedActivity[sortedActivity.length - 1].date);
        
        let currentDate = startDate;

        while (currentDate <= endDate) {
          const dateStr = currentDate.toISOString().split('T')[0];
          
          if (activityMap.has(dateStr)) {
            filledActivity.push(activityMap.get(dateStr)!);
          } else {
            filledActivity.push({
              date: dateStr,
              queries: 0,
              volume: 0
            });
          }
          currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
        finalActivityData = filledActivity;
      }
      
      console.log("Chart Activity Data (Filled):", finalActivityData);
      setQueryActivity(finalActivityData);

      // Step 6: Create Creator Leaderboard
      const creatorMap = new Map<string, CreatorStats>();
      finalLeaderboard.forEach(echo => {
          const creatorAddress = echo.creator;
          if (!creatorMap.has(creatorAddress)) {
              const tracker = creatorPriceTracker.get(creatorAddress) || { total: 0, highValue: 0 };
              const ratio = tracker.total > 0 ? (tracker.highValue / tracker.total) * 100 : 0;
              creatorMap.set(creatorAddress, {
                  address: creatorAddress, totalEchos: 0, totalEarnings: 0, totalQueries: 0, topEchoId: null, totalWalletTxs: 0, highValueEchoRatio: ratio, 
              });
          }
          const creatorEntry = creatorMap.get(creatorAddress)!;
          creatorEntry.totalEchos += 1;
          creatorEntry.totalEarnings += echo.totalPYUSDEarned;
          creatorEntry.totalQueries += echo.totalQueries; 
          if (creatorEntry.topEchoId === null) creatorEntry.topEchoId = echo.tokenId;
      });

      const finalCreatorLeaderboard = Array.from(creatorMap.values())
        .sort((a, b) => b.totalEarnings - a.totalEarnings);
      
      // Fetch TX data for top 5
      const txPromises = finalCreatorLeaderboard.slice(0, 5).map(creator => {
          return axios.get(`${BLOCKSCOUT_API_BASE}`, { params: {
              module: 'account', action: 'txlist', address: creator.address, startblock: 0, endblock: 99999999,
          }}).then(response => {
              const txCount = Array.isArray(response.data.result) ? response.data.result.length : 0;
              return { address: creator.address, txCount };
          }).catch(() => ({ address: creator.address, txCount: 0 }));
      });

      const txResults = await axios.all(txPromises);
      const updatedCreatorLeaderboard = finalCreatorLeaderboard.map(creator => {
          const txData = txResults.find(t => t.address === creator.address);
          return { ...creator, totalWalletTxs: txData?.txCount ?? 0 };
      });
      
      setCreatorLeaderboard(updatedCreatorLeaderboard);
      setLastUpdated(new Date().toLocaleString());
      
    } catch (err) {
      console.error("Blockscout Leaderboard Fetch Error:", err);
      if (err instanceof Error) {
        setError(`Failed to fetch analytics: ${err.message}. Check console for details.`);
      } else {
        setError("An unknown error occurred while fetching on-chain data.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEchoData();
    const intervalId = setInterval(fetchEchoData, 5 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, []);

  // --- Rendering Helpers ---

  const renderStatCard = (title: string, value: string, icon: string, color: string) => (
    <div className="bg-white p-5 rounded-xl shadow-lg border border-gray-100 h-full">
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
    const data = priceDistribution.filter(tier => tier.count > 0);
    return (
      <div className="h-full flex flex-col">
        <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center">
            ⚖️ Knowledge Pricing Distribution
        </h3>
        <p className="text-xs text-gray-500 mb-4">
            How creators price their specialized knowledge.
        </p>
        {data.length === 0 ? (
           <ChartPlaceholder message="No Echos have been minted yet." />
        ) : (
          <div className="flex-grow min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis 
                  type="category" 
                  dataKey="label" 
                  width={80} 
                  tick={{ fontSize: 12, fill: '#374151' }} 
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(230, 230, 230, 0.3)' }} />
                <Bar dataKey="count" name="Echos" radius={[0, 5, 5, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };
  
  const renderTopEchosChart = () => {
    const topEchosData = leaderboard.slice(0, 5).map((echo, index) => ({
        name: echo.name.length > 20 ? `${echo.name.substring(0, 20)}...` : echo.name,
        Queries: echo.totalQueries,
        fill: CHART_COLORS_SERIES[index % CHART_COLORS_SERIES.length]
    })).reverse(); 

    return (
        <div className="h-full flex flex-col">
            <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center">
                📈 Top 5 Echos by Query Volume
            </h3>
            <p className="text-xs text-gray-500 mb-4">
                Most actively used knowledge agents.
            </p>
            {topEchosData.length === 0 ? (
              <ChartPlaceholder message="No Echos have received queries yet." />
            ) : (
              <div className="flex-grow min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topEchosData} layout="vertical" margin={{ left: 30, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={100} 
                      tick={{ fontSize: 12, fill: '#374151' }} 
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(230, 230, 230, 0.3)' }} />
                    {/* Bar now reads fill from data */}
                    <Bar dataKey="Queries" radius={[0, 5, 5, 0]} fill="#8884d8">
                      {topEchosData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
        </div>
    );
  };

  const renderMarketAccessChart = () => {
    const data = [
        { name: 'Available for Query', value: marketAccessData.available, color: MARKET_ACCESS_COLORS.available },
        { name: 'Listed for Sale', value: marketAccessData.forSale, color: MARKET_ACCESS_COLORS.forSale },
        { name: 'User Purchased', value: marketAccessData.purchased, color: MARKET_ACCESS_COLORS.purchased },
    ].filter(d => d.value > 0); 

    const total = marketAccessData.available + marketAccessData.forSale + marketAccessData.purchased;

    return (
        <div className="h-full flex flex-col">
            <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center">
                🛒 Market Asset Distribution
            </h3>
            <p className="text-xs text-gray-500 mb-4">
                Breakdown of {total > 0 ? `${total} Echos` : 'Echos'} by ownership status.
            </p>
            
            {total === 0 ? (
              <ChartPlaceholder message="Mint the first Echo to see market distribution." />
            ) : (
              <div className="flex-grow min-h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius="80%"
                      fill="#8884d8"
                      dataKey="value"
                      label={(props: any) => `${(props.percent * 100).toFixed(0)}%`}
                      nameKey="name"
                      legendType="line"
                    >
                      {data.map((entry) => (
                        <Cell key={`cell-${entry.name}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      formatter={(value, entry) => (
                        <span style={{ color: entry.color, fontWeight: 500 }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
        </div>
    );
  }

  const renderQueryActivityChart = () => {
    return (
      <div className="h-full flex flex-col">
          <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center">
              📅 Daily Query Activity
          </h3>
          <p className="text-xs text-gray-500 mb-4">
              Daily query volume and PYUSD revenue over time.
          </p>
          
          {queryActivity.length < 2 ? (
            <ChartPlaceholder message={
              queryActivity.length === 0 
                ? "No query activity data available yet." 
                : "Waiting for data from a second day to draw activity chart..."
            } />
          ) : (
            <div className="flex-grow min-h-[300px]">

                <LineChart width="100%" height={300} data={queryActivity} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3"/>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#374151' }} />
                  <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.purple }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="queries" 
                    name="Queries"
                    stroke={CHART_COLORS.purple} 
                    strokeWidth={3} 
                    activeDot={{ r: 6 }} />
                  <Line 
                    type="monotone" 
                    dataKey="volume" 
                    name="Volume (PYUSD)"
                    stroke={CHART_COLORS.pink} 
                    strokeWidth={3} 
                    activeDot={{ r: 6 }} 
                  />
                </LineChart>
            </div>
          )}
      </div>
    );
  };
  
  const renderCreatorLeaderboard = () => (
    <div className="h-full">
        <h3 className="text-xl font-bold text-gray-900 mb-4">👑 Top Creators by Net Earnings</h3>
        
        {creatorLeaderboard.length === 0 ? (
          <div className="text-center text-gray-500 bg-gray-50 p-10 rounded-lg">
            No creators have earned any PYUSD yet.
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-6">
                The top 5 knowledge entrepreneurs based on total verified PYUSD earned.
            </p>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-3 py-2  text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
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
          </>
        )}
    </div>
  );


  const renderLeaderboardTable = () => {
    if (leaderboard.length === 0) {
      return (
        <div className="text-center text-gray-500 bg-gray-50 p-10 rounded-lg">
          No Echos have received paid queries yet. Be the first to chat!
        </div>
      );
    }

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
                <td className="px-6 py-4 whitespace-nowpreap text-center text-sm text-gray-500">${echo.pricePerQuery.toFixed(2)}</td>
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
          <div className="text-center mb-8 animate-fade-in">
            <h2 className="text-5xl lg:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-700 mb-4">
              🏆 Echo Marketplace Dashboard
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Live on-chain analytics powered by Blockscout.
            </p>
            {lastUpdated && !isLoading && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <p className="text-sm text-gray-600 font-medium bg-gray-100/50 px-3 py-1 rounded-full backdrop-blur-sm">
                  🕐 Last Updated: <span className="text-green-600 font-semibold">{lastUpdated}</span>
                </p>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-1000"></div>
              </div>
            )}
          </div>

          {/* Loading and Error States */}
          {isLoading && (
            <div className="mb-8">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-12 shadow-lg border border-gray-200/50 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Aggregating on-chain data from Blockscout...</h3>
                <p className="text-gray-600">This may take a few moments...</p>
              </div>
            </div>
          )}
          {error && (
            <div className="mb-8">
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-6 rounded-lg shadow-lg" role="alert">
                <p className="font-bold text-xl">Data Fetch Error</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Main Dashboard (Hidden until loaded) */}
          {!isLoading && !error && (
            <>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {renderStatCard("Protocol Fees Collected", `$${totalProtocolFees.toFixed(2)}`, "🧾", "text-red-600 bg-red-50")}
                    {renderStatCard("Avg Revenue Per Echo", `$${averageRevenuePerEcho.toFixed(2)}`, "📈", "text-cyan-600 bg-cyan-50")}
                    {renderStatCard("Secondary Sales Volume", `$${totalSecondarySales.toFixed(2)}`, "🏷️", "text-pink-600 bg-pink-50")}
                    {renderStatCard("Market Liquidity Ratio", marketLiquidityRatio, "🌊", "text-blue-600 bg-blue-50")}
                  </div>
                </div>
              </div>

              {/* Daily Activity Chart (Full Width) */}
              <div className="mb-8 animate-fade-in-delay-2">
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200/50">
                  {renderQueryActivityChart()}
                </div>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 animate-fade-in-delay-2">
                
                {totalEchosCount > 0 ? (
                  <>
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200/50 lg:col-span-1">
                      {renderMarketAccessChart()}
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200/50 lg:col-span-1">
                      {renderPriceDistribution()}
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200/50 lg:col-span-1">
                      {renderTopEchosChart()}
                    </div>
                  </>
                ) : (
                  <div className="lg:col-span-3 text-center text-gray-500 bg-white/80 p-10 rounded-lg shadow-lg">
                    Mint the first Echo to see market visualizations.
                  </div>
                )}
              </div>

              {/* Creator Leaderboard */}
              <div className="mb-8 animate-fade-in-delay-2">
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200/50">
                  {renderCreatorLeaderboard()}
                </div>
              </div>

              {/* Echo Leaderboard Table */}
              <div className="animate-fade-in-delay-2">
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden">
                  {renderLeaderboardTable()}
                </div>
              </div>
            </>
          )}
      </div>
    </div>
  );
};