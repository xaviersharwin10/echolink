import React, { useState } from 'react';
import { useAccount, useContractWrite, useWaitForTransaction, useContractRead } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { ECHOLNK_NFT_ADDRESS, ECHO_NFT_ABI } from '../config/contracts';

const PYUSD_ADDRESS = '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9';
const PYUSD_DECIMALS = 6;

const PYUSD_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
];

export const CreditManager: React.FC = () => {
  const [purchaseAmount, setPurchaseAmount] = useState('1.0');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const { address, isConnected } = useAccount();

  // Read PYUSD balance
  const { data: pyusdBalance, refetch: refetchBalance } = useContractRead({
    address: PYUSD_ADDRESS as `0x${string}`,
    abi: PYUSD_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    watch: true,
    enabled: !!address,
  });

  // Read current allowance
  const { data: currentAllowance, refetch: refetchAllowance } = useContractRead({
    address: PYUSD_ADDRESS as `0x${string}`,
    abi: PYUSD_ABI,
    functionName: 'allowance',
    args: address ? [address, ECHOLNK_NFT_ADDRESS] : undefined,
    watch: true,
    enabled: !!address,
  });

  // Read user credits
  const { data: userCredits, refetch: refetchCredits } = useContractRead({
    address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
    abi: ECHO_NFT_ABI,
    functionName: 'getUserCredits',
    args: address ? [address] : undefined,
    watch: true,
    enabled: !!address,
  });

  // Approve PYUSD
  const { writeAsync: approvePYUSD } = useContractWrite({
    address: PYUSD_ADDRESS as `0x${string}`,
    abi: PYUSD_ABI,
    functionName: 'approve',
  });

  // Purchase credits
  const { writeAsync: purchaseCredits, data: purchaseTxData } = useContractWrite({
    address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
    abi: ECHO_NFT_ABI,
    functionName: 'purchaseCredits',
  });

  const { isLoading: isPurchasePending, isSuccess: isPurchaseSuccess } = useWaitForTransaction({
    hash: purchaseTxData?.hash,
  });

  const handlePurchaseCredits = async () => {
    if (!address || !purchaseAmount) return;

    const amount = parseUnits(purchaseAmount, PYUSD_DECIMALS);
    const requiredAllowance = amount;

    // Check if we need to approve first
    if (!currentAllowance || (currentAllowance as bigint) < requiredAllowance) {
      try {
        console.log('🔐 Approving PYUSD for credit purchase...');
        const approveTx = await approvePYUSD({
          args: [ECHOLNK_NFT_ADDRESS, requiredAllowance],
        });
        console.log('✅ Approval transaction sent:', approveTx.hash);
        
        // Wait for approval (in a real app, you'd want to wait for confirmation)
        await new Promise(resolve => setTimeout(resolve, 2000));
        await refetchAllowance();
      } catch (error) {
        console.error('❌ Approval failed:', error);
        return;
      }
    }

    try {
      console.log('💳 Purchasing credits...');
      setIsPurchasing(true);
      
      const purchaseTx = await purchaseCredits({
        args: [amount],
      });
      console.log('✅ Purchase transaction sent:', purchaseTx.hash);
      
    } catch (error) {
      console.error('❌ Credit purchase failed:', error);
      setIsPurchasing(false);
    }
  };

  // Handle successful purchase
  React.useEffect(() => {
    if (isPurchaseSuccess) {
      console.log('🎉 Credits purchased successfully!');
      setIsPurchasing(false);
      setPurchaseAmount('1.0');
      refetchBalance();
      refetchCredits();
    }
  }, [isPurchaseSuccess, refetchBalance, refetchCredits]);

  const formatBalance = (balance: bigint | undefined) => {
    if (!balance) return '0';
    return formatUnits(balance, PYUSD_DECIMALS);
  };

  const formatCredits = (credits: bigint | undefined) => {
    if (!credits) return '0';
    return credits.toString();
  };

  // Extract credit data with proper typing
  const creditBalance = userCredits && Array.isArray(userCredits) ? userCredits[0] as bigint : undefined;
  const creditLastUpdated = userCredits && Array.isArray(userCredits) ? userCredits[1] as bigint : undefined;

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">🔗 Connect Your Wallet</h2>
          <p className="text-yellow-700">Please connect your wallet to manage credits</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">💳 Credit Manager</h2>
        <p className="text-gray-600">Purchase credits to pay for Echo queries without individual transactions</p>
      </div>

      {/* Current Balance */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">💰 Current Balance</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-600 mb-1">PYUSD Balance</div>
            <div className="text-2xl font-bold text-blue-800">
              {formatBalance(pyusdBalance as bigint)} PYUSD
            </div>
          </div>
          
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-sm text-green-600 mb-1">Credits Balance</div>
            <div className="text-2xl font-bold text-green-800">
              {formatCredits(creditBalance)} Credits
            </div>
            <div className="text-xs text-green-600 mt-1">
              = {((Number(creditBalance || 0)) * 0.01).toFixed(2)} PYUSD value
            </div>
          </div>
        </div>
      </div>

      {/* Purchase Credits */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold mb-4">💳 Purchase Credits</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PYUSD Amount to Purchase
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={purchaseAmount}
              onChange={(e) => setPurchaseAmount(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isPurchasing || isPurchasePending}
            />
            <p className="text-sm text-gray-500 mt-1">
              You'll receive {Math.floor(parseFloat(purchaseAmount || '0') * 100)} credits (1 PYUSD = 100 credits)
            </p>
          </div>

          <button
            onClick={handlePurchaseCredits}
            disabled={!purchaseAmount || isPurchasing || isPurchasePending}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold 
                       hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                       transition-colors duration-200"
          >
            {isPurchasing || isPurchasePending ? 'Processing...' : `Purchase ${purchaseAmount} PYUSD Credits`}
          </button>

          {isPurchaseSuccess && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
              ✅ Credits purchased successfully!
            </div>
          )}
        </div>

        {/* Credit System Info */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold text-gray-800 mb-2">ℹ️ How Credits Work</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• 1 PYUSD = 100 credits</li>
            <li>• 1 credit = 0.01 PYUSD</li>
            <li>• Use credits to pay for Echo queries without individual transactions</li>
            <li>• Credits are automatically deducted when you ask questions</li>
            <li>• Credits never expire</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
