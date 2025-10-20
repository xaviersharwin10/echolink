import React, { useState, useEffect } from 'react';
import { useNotification } from '@blockscout/app-sdk';
import { useAccount, useContractWrite, useWaitForTransaction, useContractRead } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { QUERY_PAYMENTS_ADDRESS, QUERY_PAYMENTS_ABI, ECHOLNK_NFT_ADDRESS, ECHO_NFT_ABI } from '../config/contracts';
import { EchoAnalytics } from './EchoAnalytics';

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

// ✅ EchoNFT ABI - Add your actual contract address
const ECHO_NFT_ADDRESS = ECHOLNK_NFT_ADDRESS; // TODO: Replace this

const QUERY_PAYMENTS_CONTRACT_ADDRESS = QUERY_PAYMENTS_ADDRESS;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type PaymentStep = 'idle' | 'approving' | 'approved' | 'paying' | 'paid' | 'using_credits' | 'credits_used';
type PaymentMethod = 'microtransaction' | 'credits';

interface ChatInterfaceProps {
  tokenId: bigint; // ✅ Accept tokenId as prop
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ tokenId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credits');
  
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('idle');
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>();
  const [paymentTxHash, setPaymentTxHash] = useState<`0x${string}` | undefined>();
  const [creditTxHash, setCreditTxHash] = useState<`0x${string}` | undefined>();

  const { address, isConnected } = useAccount();
  const { openTxToast } = useNotification();

  // ✅ Fetch Echo data from EchoNFT contract
  const { data: echoData, isError: echoDataError, isLoading: echoDataLoading } = useContractRead({
    address: ECHO_NFT_ADDRESS as `0x${string}`,
    abi: ECHO_NFT_ABI,
    functionName: 'getEchoData',
    args: [tokenId],
    enabled: !!tokenId,
  });

  // ✅ Extract Echo data from the struct
  // echoData returns a tuple: [name: string, description: string, creator: address, pricePerQuery: uint256, isActive: bool]
  const [echoName, echoDescription, creatorAddress, pricePerQuery, isActive] = (echoData as [string, string, string, bigint, boolean]) || [undefined, undefined, undefined, undefined, undefined];
  console.log('🔍 Echo data:', { echoName, echoDescription, creatorAddress, pricePerQuery, isActive });

  // ✅ Read PYUSD balance
  const { data: pyusdBalance, refetch: refetchBalance } = useContractRead({
    address: PYUSD_ADDRESS as `0x${string}`,
    abi: PYUSD_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    watch: true,
    enabled: !!address,
  });

  // ✅ Read current allowance
  const { data: currentAllowance, refetch: refetchAllowance } = useContractRead({
    address: PYUSD_ADDRESS as `0x${string}`,
    abi: PYUSD_ABI,
    functionName: 'allowance',
    args: address ? [address, QUERY_PAYMENTS_CONTRACT_ADDRESS] : undefined,
    watch: true,
    enabled: !!address,
  });

  // ✅ Read user credits
  const { data: userCredits, refetch: refetchCredits } = useContractRead({
    address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
    abi: ECHO_NFT_ABI,
    functionName: 'getUserCredits',
    args: address ? [address] : undefined,
    watch: true,
    enabled: !!address,
  });

  console.log('🧠 ChatInterface mounted.');
  console.log('🎫 Token ID:', tokenId.toString());
  console.log('👤 Creator Address:', creatorAddress);
  console.log('💼 Connected wallet:', address);
  console.log('🔗 QueryPayments contract:', QUERY_PAYMENTS_CONTRACT_ADDRESS);
  console.log('💰 PYUSD contract:', PYUSD_ADDRESS);
  
  if (pyusdBalance) {
    console.log('💵 PYUSD Balance:', formatUnits(pyusdBalance as bigint, PYUSD_DECIMALS), 'PYUSD');
  }
  if (currentAllowance) {
    console.log('✅ Current Allowance:', formatUnits(currentAllowance as bigint, PYUSD_DECIMALS), 'PYUSD');
  }

  // STEP 1: Approve PYUSD
  const { writeAsync: approvePYUSD } = useContractWrite({
    address: PYUSD_ADDRESS as `0x${string}`,
    abi: PYUSD_ABI,
    functionName: 'approve',
  });

  // STEP 2: Process payment
  const { writeAsync: processPayment } = useContractWrite({
    address: QUERY_PAYMENTS_CONTRACT_ADDRESS as `0x${string}`,
    abi: QUERY_PAYMENTS_ABI,
    functionName: 'processQueryPayment',
  });

  // STEP 2B: Use credits for query
  const { writeAsync: executeCreditsForQuery } = useContractWrite({
    address: ECHOLNK_NFT_ADDRESS as `0x${string}`,
    abi: ECHO_NFT_ABI,
    functionName: 'useCreditsForQuery',
  });

  const { isLoading: isApprovePending, isSuccess: isApproveSuccess } = useWaitForTransaction({
    hash: approveTxHash,
  });

  const { isLoading: isPaymentPending, isSuccess: isPaymentSuccess } = useWaitForTransaction({
    hash: paymentTxHash,
  });

  const { isLoading: isCreditPending, isSuccess: isCreditSuccess } = useWaitForTransaction({
    hash: creditTxHash,
  });

  // Handle approval success
  useEffect(() => {
    const executePayment = async () => {
      if (isApproveSuccess && paymentStep === 'approving' && creatorAddress) {  
        console.log('✅ Approval confirmed on-chain');
        setPaymentStep('approved');

        await refetchAllowance();

        try {
          console.log('💸 Step 2: Initiating processQueryPayment...');
          console.log('💸 Paying creator:', creatorAddress);
          const queryCost = pricePerQuery ? Number(pricePerQuery) / 1000000 : 0.1; // Convert from wei to PYUSD
          const amount = parseUnits(queryCost.toString(), PYUSD_DECIMALS);
          
          const paymentTx = await processPayment({
            args: [creatorAddress as `0x${string}`, amount, tokenId], // ✅ Using dynamic creator address
          });
          console.log('✅ Payment transaction sent:', paymentTx.hash);
          openTxToast("11155111", paymentTx.hash);
          setPaymentTxHash(paymentTx.hash);
          setPaymentStep('paying');
        } catch (error: any) {
          console.error('❌ Payment transaction failed:', error);
          handlePaymentError(error);
        }
      }
    };

    executePayment();
  }, [isApproveSuccess, paymentStep, creatorAddress]);

  // Handle payment success
  useEffect(() => {
    const callAIBackend = async () => {
      if (isPaymentSuccess && paymentStep === 'paying') {
        console.log('🎉 Payment confirmed on-chain');
        setPaymentStep('paid');

        await refetchBalance();

        try {
          console.log('📡 Sending question to backend:', currentQuestion);
          console.log('💰 Payment transaction hash:', paymentTxHash);
          console.log('👤 User address:', address);
          
          const response = await fetch('http://localhost:8002/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              query: currentQuestion, // ✅ Updated field name to match backend
              token_id: tokenId.toString(), // ✅ Updated field name to match backend
              payment_tx_hash: paymentTxHash, // ✅ Send payment transaction hash
              user_address: address, // ✅ Send user address
              use_credits: false, // ✅ Using microtransaction
            }),
          });

          console.log('✅ Backend responded:', response.status);
          const data = await response.json();
          console.log('📦 AI response data:', data);

          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: data.answer || 'Sorry, I could not process your request.',
            },
          ]);
        } catch (error) {
          console.error('❌ Error querying backend:', error);
          setMessages(prev => [
            ...prev,
            { role: 'assistant', content: 'Error: Could not connect to the backend.' },
          ]);
        } finally {
          resetPaymentFlow();
        }
      }
    };

    callAIBackend();
  }, [isPaymentSuccess, paymentStep, currentQuestion, tokenId]);

  // Handle credit success
  useEffect(() => {
    const callAIBackendWithCredits = async () => {
      if (isCreditSuccess && paymentStep === 'using_credits') {
        console.log('🎉 Credits used successfully');
        setPaymentStep('credits_used');

        await refetchCredits();

        try {
          console.log('📡 Sending question to backend with credits:', currentQuestion);
          console.log('💳 Credit transaction hash:', creditTxHash);
          console.log('👤 User address:', address);
          
          const response = await fetch('http://localhost:8002/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              query: currentQuestion,
              token_id: tokenId.toString(),
              payment_tx_hash: creditTxHash, // Send credit transaction hash
              user_address: address,
              use_credits: true, // ✅ Using credits
            }),
          });

          console.log('✅ Backend responded:', response.status);
          const data = await response.json();
          console.log('📦 AI response data:', data);

          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: data.answer || 'Sorry, I could not process your request.',
            },
          ]);
        } catch (error) {
          console.error('❌ Error querying backend:', error);
          setMessages(prev => [
            ...prev,
            { role: 'assistant', content: 'Error: Could not connect to the backend.' },
          ]);
        } finally {
          resetPaymentFlow();
        }
      }
    };

    callAIBackendWithCredits();
  }, [isCreditSuccess, paymentStep, currentQuestion, tokenId]);

  const resetPaymentFlow = () => {
    setIsLoading(false);
    setPaymentStep('idle');
    setApproveTxHash(undefined);
    setPaymentTxHash(undefined);
    setCreditTxHash(undefined);
    setCurrentQuestion('');
  };

  const handlePaymentError = (error: any) => {
    console.error('❌ Payment flow failed:');
    console.error('   ↳ Error name:', error.name);
    console.error('   ↳ Message:', error.message);
    console.error('   ↳ Full error object:', error);

    let readableError = 'Payment failed. Please check your wallet and try again.';
    if (error?.shortMessage) readableError = error.shortMessage;
    if (error?.cause?.message) readableError = error.cause.message;

    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: `❌ Payment failed: ${readableError}` },
    ]);
    
    resetPaymentFlow();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('🟢 handleSubmit triggered');
    if (!input.trim()) {
      console.warn('⚠️ Input is empty');
      return;
    }
    if (!isConnected || !address) {
      console.error('❌ No wallet connected');
      alert('Please connect your wallet first.');
      return;
    }

    // ✅ Check if creator address is loaded
    if (!creatorAddress) {
      console.error('❌ Creator address not loaded');
      alert('Echo data is still loading. Please wait...');
      return;
    }

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setCurrentQuestion(input);
    setInput('');
    setIsLoading(true);

    const queryCost = pricePerQuery ? Number(pricePerQuery) / 1000000 : 0.1; // Convert from wei to PYUSD
    const requiredCredits = Math.ceil(queryCost * 100); // 1 PYUSD = 100 credits

    // Extract credit balance
    const creditBalance = userCredits && Array.isArray(userCredits) ? userCredits[0] as bigint : BigInt(0);

    if (paymentMethod === 'credits') {
      // Check if user has enough credits
      if (creditBalance < BigInt(requiredCredits)) {
        alert(`Insufficient credits. You have ${creditBalance.toString()} credits but need ${requiredCredits} credits (${queryCost} PYUSD)`);
        setIsLoading(false);
        return;
      }

      try {
        console.log('💳 Using credits for query...');
        setPaymentStep('using_credits');
        
        const creditTx = await executeCreditsForQuery({
          args: [address, tokenId, BigInt(requiredCredits)],
        });
        
        console.log('✅ Credit transaction sent:', creditTx.hash);
        openTxToast("11155111", creditTx.hash);
        setCreditTxHash(creditTx.hash);
        
      } catch (error: any) {
        handlePaymentError(error);
      }
    } else {
      // Microtransaction flow
      const requiredAmount = parseUnits(queryCost.toString(), PYUSD_DECIMALS);
      if (pyusdBalance && (pyusdBalance as bigint) < requiredAmount) {
        const balance = formatUnits(pyusdBalance as bigint, PYUSD_DECIMALS);
        alert(`Insufficient PYUSD balance. You have ${balance} PYUSD but need ${queryCost} PYUSD`);
        setIsLoading(false);
        return;
      }

      try {
        console.log('🔐 Step 1: Approving PYUSD spend...');
        setPaymentStep('approving');
        
        const amount = parseUnits(queryCost.toString(), PYUSD_DECIMALS);
        console.log('💰 Approving amount:', amount.toString(), 'raw units');
        
        const approveTx = await approvePYUSD({
          args: [QUERY_PAYMENTS_CONTRACT_ADDRESS, amount],
        });
        
        console.log('✅ Approval transaction sent:', approveTx.hash);
        openTxToast("11155111", approveTx.hash); // "11155111" is the chain ID for Sepolia
        setApproveTxHash(approveTx.hash);
        
      } catch (error: any) {
        handlePaymentError(error);
      }
    }
  };

  const getStatusMessage = () => {
    if (paymentStep === 'approving' || isApprovePending) {
      return 'Approving PYUSD spend...';
    }
    if (paymentStep === 'approved') {
      return 'Approval confirmed, initiating payment...';
    }
    if (paymentStep === 'paying' || isPaymentPending) {
      return 'Processing payment on-chain...';
    }
    if (paymentStep === 'paid') {
      return 'Querying AI...';
    }
    if (paymentStep === 'using_credits' || isCreditPending) {
      return 'Using credits for query...';
    }
    if (paymentStep === 'credits_used') {
      return 'Querying AI...';
    }
    return 'Processing...';
  };

  const formatBalance = (balance: bigint | undefined) => {
    if (!balance) return '0';
    return formatUnits(balance, PYUSD_DECIMALS);
  };

  // ✅ Show loading state while fetching echo data
  if (echoDataLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Echo data...</p>
        </div>
      </div>
    );
  }

  // ✅ Show error state if echo data fetch fails
  if (echoDataError || !creatorAddress) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 font-semibold mb-2">❌ Failed to load Echo data</p>
          <p className="text-red-600 text-sm">Token ID: {tokenId.toString()}</p>
          <p className="text-gray-600 text-sm mt-2">This Echo may not exist or there was an error loading it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Chat with Echo #{tokenId.toString()}</h2>
      {creatorAddress && <EchoAnalytics creatorAddress={creatorAddress} tokenId={tokenId} />}

      {/* ✅ Echo Info Display */}
      <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
        <div className="text-sm space-y-1">
          <div className="font-semibold text-purple-900">Echo Information</div>
          <div className="text-purple-700">
            🎫 Token ID: <span className="font-mono">{tokenId.toString()}</span>
          </div>
          <div className="text-purple-700">
            📝 Name: <span className="font-semibold">{echoName || 'Loading...'}</span>
          </div>
          <div className="text-purple-700">
            👤 Creator: <span className="font-mono text-xs">{creatorAddress ? `${creatorAddress.slice(0, 6)}...${creatorAddress.slice(-4)}` : 'Loading...'}</span>
          </div>
          <div className="text-purple-700">
            💰 Price: <span className="font-semibold">{pricePerQuery ? `${(Number(pricePerQuery) / 1000000).toFixed(2)} PYUSD` : 'Loading...'}</span>
          </div>
          <div className="text-purple-600 text-xs">
            📚 Description: {echoDescription ? `${echoDescription.slice(0, 50)}...` : 'Loading...'}
          </div>
          {isActive === false && (
            <div className="text-red-600 text-xs font-semibold">
              ⚠️ This Echo is currently inactive
            </div>
          )}
        </div>
      </div>

      {/* ✅ Balance Display */}
      {address && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-sm space-y-1">
            <div className="font-semibold text-blue-900">Wallet Info</div>
            <div className="text-blue-700">
              💰 PYUSD Balance: <span className="font-mono font-bold">{formatBalance(pyusdBalance as bigint)}</span> PYUSD
            </div>
            <div className="text-blue-700">
              ✅ Allowance: <span className="font-mono">{formatBalance(currentAllowance as bigint)}</span> PYUSD
            </div>
            <div className="text-green-700">
              💳 Credits: <span className="font-mono font-bold">{userCredits && Array.isArray(userCredits) ? userCredits[0].toString() : '0'}</span> credits
            </div>
            <div className="text-blue-600 text-xs">
              📍 {address.slice(0, 6)}...{address.slice(-4)}
            </div>
          </div>
        </div>
      )}

      {/* ✅ Payment Method Selector */}
      {address && (
        <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="text-sm space-y-2">
            <div className="font-semibold text-purple-900">Payment Method</div>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="credits"
                  checked={paymentMethod === 'credits'}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="mr-2"
                />
                <span className="text-purple-700">💳 Use Credits</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="microtransaction"
                  checked={paymentMethod === 'microtransaction'}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="mr-2"
                />
                <span className="text-purple-700">💰 Direct Payment</span>
              </label>
            </div>
            <div className="text-xs text-purple-600">
              {paymentMethod === 'credits' 
                ? `Using ${Math.ceil((pricePerQuery ? Number(pricePerQuery) / 1000000 : 0.1) * 100)} credits (${(pricePerQuery ? Number(pricePerQuery) / 1000000 : 0.1).toFixed(2)} PYUSD)`
                : `Direct payment of ${(pricePerQuery ? Number(pricePerQuery) / 1000000 : 0.1).toFixed(2)} PYUSD`
              }
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-4 h-96 overflow-y-auto mb-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-gray-400 text-center py-8">
            Start a conversation by asking a question... (Each query costs {pricePerQuery ? `${(Number(pricePerQuery) / 1000000).toFixed(2)}` : '0.1'} PYUSD)
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`${
              msg.role === 'user' 
                ? 'bg-blue-100 ml-auto text-right' 
                : 'bg-white mr-auto'
            } max-w-md p-3 rounded-lg shadow-sm`}
          >
            <div className="font-semibold text-sm mb-1">
              {msg.role === 'user' ? 'You' : 'AI Assistant'}
            </div>
            <div className="text-gray-800">{msg.content}</div>
          </div>
        ))}

        {isLoading && (
          <div className="bg-white mr-auto max-w-md p-3 rounded-lg shadow-sm">
            <div className="font-semibold text-sm mb-1">AI Assistant</div>
            <div className="text-gray-500 flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              {getStatusMessage()}
            </div>
            {approveTxHash && (
              <div className="text-xs text-gray-400 mt-1">
                Approval tx: {approveTxHash.slice(0, 10)}...
              </div>
            )}
            {paymentTxHash && (
              <div className="text-xs text-gray-400 mt-1">
                Payment tx: {paymentTxHash.slice(0, 10)}...
              </div>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading || !address}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim() || !address}
          className="bg-blue-600 text-white py-2 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {isLoading ? 'Processing...' : 
            paymentMethod === 'credits' 
              ? `Send (${Math.ceil((pricePerQuery ? Number(pricePerQuery) / 1000000 : 0.1) * 100)} credits)`
              : `Send (${pricePerQuery ? `${(Number(pricePerQuery) / 1000000).toFixed(2)}` : '0.1'} PYUSD)`
          }
        </button>
      </form>

      {!address && (
        <div className="text-center text-red-500 mt-2">
          Please connect your wallet to chat.
        </div>
      )}

      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-2 bg-gray-100 rounded text-xs font-mono">
          <div>Token ID: {tokenId.toString()}</div>
          <div>Creator: {creatorAddress}</div>
          <div>Payment Method: {paymentMethod}</div>
          <div>Payment Step: {paymentStep}</div>
          <div>Approve Pending: {isApprovePending ? 'Yes' : 'No'}</div>
          <div>Payment Pending: {isPaymentPending ? 'Yes' : 'No'}</div>
          <div>Credit Pending: {isCreditPending ? 'Yes' : 'No'}</div>
          <div>Balance: {pyusdBalance?.toString() || 'N/A'} (raw units)</div>
          <div>Allowance: {currentAllowance?.toString() || 'N/A'} (raw units)</div>
          <div>Credits: {userCredits && Array.isArray(userCredits) ? userCredits[0].toString() : 'N/A'}</div>
        </div>
      )}
    </div>
  );
};