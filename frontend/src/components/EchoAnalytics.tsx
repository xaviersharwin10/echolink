import React, { useState, useEffect } from 'react';
import { useTransactionPopup } from '@blockscout/app-sdk';
import { ECHOLNK_NFT_ADDRESS } from '../config/contracts';

const API_BASE_URL = 'https://eth-sepolia.blockscout.com/api/v2';
const PYUSD_TOKEN_ADDRESS = '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9';

interface AnalyticsData {
  totalQueries: number;
  totalEarnings: string;
  transferCount: number;
}

interface EchoAnalyticsProps {
  creatorAddress: string;
  tokenId: bigint;
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


export const EchoAnalytics: React.FC<EchoAnalyticsProps> = ({ creatorAddress, tokenId }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { openPopup } = useTransactionPopup();

  const handleViewHistoryClick = () => {
    openPopup({
      chainId: "11155111", // Sepolia's Chain ID
      address: creatorAddress,
    });
  };

  useEffect(() => {
    if (!creatorAddress || !tokenId) return;

    const fetchAnalyticsData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [tokenTransfersRes, nftTransfersRes] = await Promise.all([
          fetch(`${API_BASE_URL}/addresses/${creatorAddress}/token-transfers?token=${PYUSD_TOKEN_ADDRESS}`),
          fetch(`${API_BASE_URL}/tokens/${ECHOLNK_NFT_ADDRESS}/instances/${tokenId}/transfers`)
        ]);

        if (!tokenTransfersRes.ok || !nftTransfersRes.ok) {
          throw new Error('Failed to fetch data from Blockscout');
        }

        const tokenTransfers = await tokenTransfersRes.json();
        const nftTransfers = await nftTransfersRes.json();
        
        const incomingTransfers = tokenTransfers.items.filter((tx: any) => tx.to.hash.toLowerCase() === creatorAddress.toLowerCase());
        
        const totalEarningsRaw = incomingTransfers.reduce((sum: bigint, tx: any) => sum + BigInt(tx.total.value), BigInt(0));

        setData({
          totalQueries: incomingTransfers.length,
          totalEarnings: (Number(totalEarningsRaw) / 1e6).toFixed(2),
          transferCount: nftTransfers.items.length,
        });

      } catch (err) {
        console.error("Error fetching analytics:", err);
        setError("Could not load on-chain data.");
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
          On-Chain Analytics
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