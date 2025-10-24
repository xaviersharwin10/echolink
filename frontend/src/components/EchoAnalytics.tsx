import React, { useState, useEffect } from 'react';
import {useChainId} from 'wagmi';
import { useTransactionPopup } from '@blockscout/app-sdk';
import { ECHOLNK_NFT_ADDRESS, QUERY_PAYMENTS_ADDRESS, QUERY_PAID_TOPIC, CREDITS_USED_TOPIC } from '../config/contracts';

const API_BASE_URL = 'https://eth-sepolia.blockscout.com/api'; 
const PYUSD_DECIMALS = 6;
const PYUSD_RATE_PER_CREDIT = 0.01;
const PROTOCOL_FEE_PERCENT = 0.05; 

interface AnalyticsData {
  totalQueries: number;
  totalEarnings: string;
  transferCount: number;
}

interface EchoAnalyticsProps {
  creatorAddress: string;
  tokenId: bigint;
}

interface LogEvent {
  topics: string[];
  data: string;
  timeStamp: string;
}

const SkeletonCard: React.FC = () => (
  <div className="p-4 bg-gray-100 rounded-xl animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
    <div className="h-8 bg-gray-300 rounded w-1/2"></div>
  </div>
);

const StatCard: React.FC<{ icon: string; label: string; value: string | number; theme: string }> = ({ icon, label, value, theme }) => (
  <div className={`p-5 rounded-2xl ${theme}`}>
    <div className="flex items-center">
      <div className="text-2xl mr-3">{icon}</div>
      <div>
        <p className="text-sm font-semibold opacity-70">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  </div>
);

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
  const url = `${API_BASE_URL}?${query}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status === '0') {
    return [];
  }
  return data.result || [];
};

const fetchBlockscoutRestData = async (endpoint: string): Promise<any> => {
    const url = `${API_BASE_URL}/v2/${endpoint}`;
    
    const response = await fetch(url);
    const data = await response.json();
    return data;
};


export const EchoAnalytics: React.FC<EchoAnalyticsProps> = ({ creatorAddress, tokenId }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const chainId = useChainId();
  const { openPopup } = useTransactionPopup();

  const handleViewHistoryClick = () => {
    openPopup({
      chainId: chainId.toString(),
      address: creatorAddress,
    });
  };

  useEffect(() => {
    if (!creatorAddress || !tokenId || tokenId <= BigInt(0)) {
      if (isLoading) setIsLoading(false);
      return; 
    }
    
    const tokenIdNumber = Number(tokenId);

    const fetchAnalyticsData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // --- Step 1: Fetch Event Logs (PYUSD and Credits) ---
        const [queryPaidLogs, creditsUsedLogs] = await Promise.all([
          // 1. QueryPaid (Direct PYUSD): Logs from the QueryPayments contract
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

        // --- Step 2: Filter Logs by Specific Token ID and Aggregate ---
        let totalQueries = 0;
        let totalEarnings = 0; // Net earnings

        const processLogs = (logs: LogEvent[], isCredit: boolean) => {
          console.log(`Processing ${isCredit ? 'CreditsUsed' : 'QueryPaid'} logs, total:`, logs.length);
          
          logs.forEach(log => {
            // Determine which topic holds the Token ID based on the event signature
            // QueryPaid signature (4 topics): Topic 3 is tokenId
            // CreditsUsed signature (3 topics): Topic 2 is echoId
            const tokenTopicIndex = isCredit ? 2 : 3;


            // Check if log has enough topics and if the Token ID matches
            if (log.topics.length > tokenTopicIndex) {
              const logTokenId = safeParseTokenId(log.topics[tokenTopicIndex]);
              console.log("Comparing log tokenId", logTokenId, "with", tokenIdNumber);
              
              if (logTokenId === tokenIdNumber) {
                totalQueries++;
                console.log("Matched log for tokenId", tokenIdNumber, "logTokenId:", logTokenId);
                
                // Calculate Gross Value
                const amountWei = log.data && log.data !== '0x' ? BigInt(log.data) : BigInt(0);
                let grossValue = 0;

                if (isCredit) {
                  // CreditsUsed data is the non-indexed credit count (amount in the data field)
                  const creditsUsed = Number(amountWei);
                  console.log("Credits used from log:", creditsUsed);
                  grossValue = creditsUsed * PYUSD_RATE_PER_CREDIT;
                } else {
                  // QueryPaid data is the full PYUSD amount (amount in the data field)
                  grossValue = Number(amountWei) / (10 ** PYUSD_DECIMALS);
                }

                // Calculate Net Earnings (after 5% fee)
                totalEarnings += grossValue * (1 - PROTOCOL_FEE_PERCENT);
                console.log("Processed log for tokenId", tokenIdNumber, "grossValue:", grossValue);
              }
            }
          });
        };

        processLogs(queryPaidLogs, false);
        processLogs(creditsUsedLogs, true);

        // --- Step 3: Fetch NFT Transfer Count (Still needs separate REST API) ---
        const nftTransfersData = await fetchBlockscoutRestData(`tokens/${ECHOLNK_NFT_ADDRESS}/instances/${tokenIdNumber}/transfers`);
        
        const transferCount = nftTransfersData.items ? nftTransfersData.items.length : 0;
        
        const finalData = {
          totalQueries: totalQueries,
          totalEarnings: totalEarnings.toFixed(2),
          transferCount: transferCount,
        };
        
        setData(finalData);

      } catch (err) {
        console.error("❌ Error fetching analytics:", err);
        setError("Could not load on-chain data for Echo. Please check contract addresses.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [creatorAddress, tokenId]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8 bg-red-50 rounded-lg">
          <p className="text-red-600 font-semibold">{error}</p>
          <p className="text-red-500 text-sm mt-1">Please try again later.</p>
        </div>
      );
    }

    if (data) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <StatCard icon="❓" label="Total Queries" value={data.totalQueries} theme="bg-blue-100 text-blue-900" />
          <StatCard icon="💰" label="Total Earnings" value={`$${data.totalEarnings}`} theme="bg-green-100 text-green-900" />
          <StatCard icon="🔄" label="Owner Transfers" value={data.transferCount} theme="bg-purple-100 text-purple-900" />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="mb-6 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-xl font-bold text-gray-800">
          On-Chain Analytics (Verified Ledger)
        </h3>
        <button
          onClick={handleViewHistoryClick}
          className="text-sm font-semibold py-2 px-4 rounded-lg bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-colors"
        >
          View All Transactions
        </button>
      </div>
      {renderContent()}
    </div>
  );
};
