import React, { useState } from 'react';
import { useContractRead } from 'wagmi';
import { ChatInterface } from './ChatInterface';
import { ECHOLNK_NFT_ADDRESS, ECHO_NFT_ABI } from '../config/contracts';

const ECHO_NFT_ADDRESS = ECHOLNK_NFT_ADDRESS;
  

interface EchoInfo {
  tokenId: number;
  creator: string;
  name: string;
  description: string;
  pricePerQuery: bigint;
  isActive: boolean;
  owner: string;
}

export const EchoSelector: React.FC = () => {
  const [selectedTokenId, setSelectedTokenId] = useState<bigint | null>(null);
  const [manualTokenId, setManualTokenId] = useState<string>('');
  const [availableEchos, setAvailableEchos] = useState<EchoInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string>('');

  // --- useContractRead setup for dynamic token checking ---
  const [checkId, setCheckId] = useState<bigint | null>(null);

  const { data: echoData, error: echoError } = useContractRead({
    address: ECHO_NFT_ADDRESS as `0x${string}`,
    abi: ECHO_NFT_ABI,
    functionName: 'getEchoData',
    args: checkId ? [checkId] : undefined,
    enabled: !!checkId,
    watch: false,
  });

  const { data: ownerData, error: ownerError } = useContractRead({
    address: ECHO_NFT_ADDRESS as `0x${string}`,
    abi: ECHO_NFT_ABI,
    functionName: 'ownerOf',
    args: checkId ? [checkId] : undefined,
    enabled: !!checkId,
    watch: false,
  });

  // Function to check if token exists using useContractRead hooks
  const checkTokenExists = async (tokenId: number): Promise<EchoInfo | null> => {
    try {
      setCheckId(BigInt(tokenId));

      // wait a tiny bit for hooks to update
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (!echoData || echoError) return null;
      if (!ownerData || ownerError) return null;

      const [name, description, creator, pricePerQuery, isActive, purchasePrice, isForSale, ownerFromData] = echoData as unknown as [string, string, `0x${string}`, bigint, boolean, bigint, boolean, `0x${string}`];
      const owner = ownerData as string;
      console.log('🔍 Echo data:', { creator, owner, name, description, pricePerQuery, isActive });
      return { tokenId, creator, name, description, pricePerQuery, isActive, owner };
    } catch (err) {
      console.error(`❌ Error checking token ${tokenId}:`, err);
      return null;
    }
  };

  // Scan for available Echos (token IDs 1-10)
  const scanForEchos = async () => {
    setIsScanning(true);
    setScanError('');
    const found: EchoInfo[] = [];

    console.log('🔍 Scanning for Echos...');

    for (let i = 0; i <= 10; i++) {
      const echoInfo = await checkTokenExists(i);
      if (echoInfo) {
        console.log(`✅ Found Echo #${i}`);
        found.push(echoInfo);
      }
    }

    setAvailableEchos(found);
    setIsScanning(false);

    if (found.length === 0) {
      setScanError('No Echos found in range 1-10. Try entering a specific token ID or mint a new Echo.');
    } else {
      console.log(`🎉 Found ${found.length} Echo(s)`);
    }
  };

  // Handle manual token ID entry
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tokenId = parseInt(manualTokenId);
    if (isNaN(tokenId) || tokenId < 1) {
      alert('Please enter a valid token ID (positive number)');
      return;
    }

    console.log(`✅ Attempting to load Echo #${tokenId}`);
    setSelectedTokenId(BigInt(tokenId));
  };

  // If a token is selected, show chat interface
  if (selectedTokenId !== null) {
    return (
      <div>
        <button
          onClick={() => setSelectedTokenId(null)}
          className="mb-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          ← Back to Echo Selection
        </button>
        <ChatInterface tokenId={selectedTokenId} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Select an Echo to Chat With</h2>

      {/* Manual Token ID Entry */}
      <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200">
        <h3 className="text-lg font-semibold mb-3 text-blue-900">📍 Enter Token ID</h3>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="number"
            value={manualTokenId}
            onChange={(e) => setManualTokenId(e.target.value)}
            placeholder="Enter token ID (e.g., 1)"
            className="flex-1 px-4 py-3 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            min="1"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white py-3 px-8 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
          >
            Load Echo →
          </button>
        </form>
        <p className="text-sm text-blue-600 mt-2">
          💡 If you know the token ID, enter it above to start chatting immediately
        </p>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-gray-300"></div>
        <span className="text-gray-500 font-medium">OR</span>
        <div className="flex-1 h-px bg-gray-300"></div>
      </div>

      {/* Scan for Available Echos */}
      <div className="mb-6 p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border-2 border-purple-200">
        <h3 className="text-lg font-semibold mb-3 text-purple-900">🔍 Browse Available Echos</h3>
        <button
          onClick={scanForEchos}
          disabled={isScanning}
          className="bg-purple-600 text-white py-3 px-8 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg w-full sm:w-auto"
        >
          {isScanning ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              Scanning...
            </span>
          ) : (
            '🔍 Scan for Echos (ID 1–10)'
          )}
        </button>
        <p className="text-sm text-purple-600 mt-2">
          💡 This will check token IDs 1–10 to find existing Echos
        </p>
      </div>

      {/* Scan Error */}
      {scanError && (
        <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-yellow-800 text-sm">⚠️ {scanError}</p>
        </div>
      )}

      {/* Display Found Echos */}
      {availableEchos.length > 0 && (
        <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
          <h3 className="text-xl font-semibold mb-4 text-gray-900">
            📚 Found {availableEchos.length} Echo{availableEchos.length > 1 ? 's' : ''}
          </h3>
          <div className="space-y-3">
            {availableEchos.map((echo) => (
              <div
                key={echo.tokenId}
                className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200 hover:border-blue-400 transition-all hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-bold text-lg text-blue-900">
                      {echo.name || `Echo #${echo.tokenId}`}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {echo.description || 'No description available'}
                    </p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span>👤 Owner: {echo.owner.slice(0, 6)}...{echo.owner.slice(-4)}</span>
                      <span>💰 Price: {(Number(echo.pricePerQuery) / 1000000).toFixed(2)} PYUSD</span>
                      <span className={echo.isActive ? 'text-green-600' : 'text-red-600'}>
                        {echo.isActive ? '✅ Active' : '❌ Inactive'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedTokenId(BigInt(echo.tokenId))}
                    disabled={!echo.isActive}
                    className="bg-blue-600 text-white py-2 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors ml-4 shadow-md hover:shadow-lg"
                  >
                    {echo.isActive ? 'Chat →' : 'Inactive'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
