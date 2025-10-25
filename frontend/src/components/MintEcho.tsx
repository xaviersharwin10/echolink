import React, { useState, useEffect } from 'react';
import { useAccount, useContractWrite, useWaitForTransaction, useChainId} from 'wagmi';
import { useNotification } from '@blockscout/app-sdk';
import { ECHOLNK_NFT_ADDRESS, ECHO_NFT_ABI } from '../config/contracts';

interface MintEchoProps {
  tokenId?: string;
  echoName?: string;
  echoDescription?: string;
  pricePerQuery?: string;
  purchasePrice?: string;
  isForSale?: boolean;
  onMintComplete?: () => void;
}

export const MintEcho: React.FC<MintEchoProps> = ({ 
  tokenId: propTokenId,
  echoName: propEchoName, 
  echoDescription: propEchoDescription, 
  pricePerQuery: propPricePerQuery,
  purchasePrice: propPurchasePrice,
  isForSale: propIsForSale,
  onMintComplete 
}) => {
  const [echoName, setEchoName] = useState(propEchoName || '');
  const [echoDescription, setEchoDescription] = useState(propEchoDescription || '');
  const [pricePerQuery, setPricePerQuery] = useState(propPricePerQuery || '0.1');
  const [purchasePrice, setPurchasePrice] = useState(propPurchasePrice || '50.0');
  const [isForSale, setIsForSale] = useState(propIsForSale !== undefined ? propIsForSale : true);
  const { address } = useAccount();
  const chainId = useChainId();
  const { openTxToast } = useNotification();
  
  const { data, write, isLoading: isWriteLoading } = useContractWrite({
    address: ECHOLNK_NFT_ADDRESS,
    abi: ECHO_NFT_ABI,
    functionName: 'safeMint',
  });

  const { isLoading: isTransactionLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  useEffect(() => {
    if (data?.hash) {
      openTxToast(chainId.toString(), data.hash);
    }
  }, [data?.hash, openTxToast]);

  // Handle mint completion
  useEffect(() => {
    if (isSuccess && onMintComplete) {
      onMintComplete();
    }
  }, [isSuccess, onMintComplete]);

  const handleMint = () => {
    if (!address || !echoName.trim() || !echoDescription.trim()) return;
    
    // Use provided token ID or generate a default one
    const tokenIdToUse = BigInt(propTokenId || Date.now().toString());
    
    // Convert prices to wei (assuming 6 decimals for PYUSD)
    const priceInWei = BigInt(Math.floor(parseFloat(pricePerQuery) * 1000000));
    const purchasePriceInWei = BigInt(Math.floor(parseFloat(purchasePrice) * 1000000));
    
    write({
      args: [tokenIdToUse, address, echoName, echoDescription, priceInWei, purchasePriceInWei, isForSale],
    });
  };

  return (
    <div className="mint-echo-container">
      {!propEchoName && <h2 className="text-2xl font-bold mb-4">Mint Your Echo NFT</h2>}
      
      <div className="space-y-4">
        {!propEchoName && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">
                Echo Name *
              </label>
              <input
                type="text"
                value={echoName}
                onChange={(e) => setEchoName(e.target.value)}
                placeholder="Enter a name for your Echo"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!address}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Description *
              </label>
              <textarea
                value={echoDescription}
                onChange={(e) => setEchoDescription(e.target.value)}
                placeholder="Describe what knowledge this Echo contains"
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!address}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Price per Query (PYUSD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={pricePerQuery}
                onChange={(e) => setPricePerQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!address}
              />
              <p className="text-sm text-gray-500 mt-1">
                Users will pay this amount in PYUSD for each query
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Purchase Price (PYUSD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!address}
              />
              <p className="text-sm text-gray-500 mt-1">
                Price for users to buy the entire Echo (unlimited access)
              </p>
            </div>

            <div>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={isForSale}
                  onChange={(e) => setIsForSale(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  disabled={!address}
                />
                <span className="text-sm font-medium text-gray-700">
                  List Echo for Sale
                </span>
              </label>
              <p className="text-sm text-gray-500 mt-1 ml-7">
                Allow users to purchase unlimited access to this Echo
              </p>
            </div>
          </>
        )}

        <button
          onClick={handleMint}
          disabled={!address || !echoName.trim() || !echoDescription.trim() || isWriteLoading || isTransactionLoading}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold 
                    hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                    transition-colors duration-200"
        >
          {isWriteLoading || isTransactionLoading ? 'Minting...' : 'Mint Echo NFT'}
        </button>

        {isSuccess && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            ✅ Echo NFT minted successfully! {propEchoName && 'Your knowledge is now live on the blockchain!'}
          </div>
        )}

        {!address && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
            ⚠️ Please connect your wallet to mint an Echo
          </div>
        )}
      </div>
    </div>
  );
};
