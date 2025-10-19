import React, { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useDropzone } from 'react-dropzone';
import { MintEcho } from './MintEcho';

type WizardStep = 'upload' | 'processing' | 'configure' | 'minting';

interface EchoConfig {
  name: string;
  description: string;
  pricePerQuery: string;
}

interface ProcessingResult {
  knowledgeHash: string;
  tokenId: string;
  fileName: string;
  fileSize: number;
}

export const CreatorStudio: React.FC = () => {
  const [step, setStep] = useState<WizardStep>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [echoConfig, setEchoConfig] = useState<EchoConfig>({
    name: '',
    description: '',
    pricePerQuery: '0.1'
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { address, isConnected } = useAccount();

  // File upload handler
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    setUploadedFile(file);
    setError(null);
    setIsProcessing(true);
    setStep('processing');

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);

      console.log('📤 Uploading file:', file.name, 'Size:', file.size);

      const response = await fetch('http://localhost:8000/api/ingest-single-knowledge', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      console.log('✅ Processing result:', result);

      setProcessingResult({
        knowledgeHash: result.knowledgeHash,
        tokenId: result.tokenId,
        fileName: file.name,
        fileSize: file.size
      });

      // Auto-fill Echo name from filename
      const nameFromFile = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
      setEchoConfig(prev => ({
        ...prev,
        name: nameFromFile
      }));

      setStep('configure');
    } catch (err: any) {
      console.error('❌ Upload failed:', err);
      setError(err.message || 'Failed to process file');
      setStep('upload');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'video/mp4': ['.mp4'],
      'video/quicktime': ['.mov'],
      'audio/mpeg': ['.mp3'],
      'audio/wav': ['.wav']
    },
    maxFiles: 1,
    disabled: isProcessing
  });

  const handleConfigureSubmit = () => {
    if (!echoConfig.name.trim() || !echoConfig.description.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    setStep('minting');
  };

  const handleMintComplete = () => {
    // Reset wizard after successful mint
    setStep('upload');
    setUploadedFile(null);
    setProcessingResult(null);
    setEchoConfig({ name: '', description: '', pricePerQuery: '0.1' });
    setError(null);
  };

  const resetWizard = () => {
    setStep('upload');
    setUploadedFile(null);
    setProcessingResult(null);
    setEchoConfig({ name: '', description: '', pricePerQuery: '0.1' });
    setError(null);
    setIsProcessing(false);
  };

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">🔗 Connect Your Wallet</h2>
          <p className="text-yellow-700">Please connect your wallet to create an Echo NFT</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">🎨 Creator Studio</h2>
        <p className="text-gray-600">Transform your knowledge into an AI-powered Echo NFT</p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {(['upload', 'processing', 'configure', 'minting'] as WizardStep[]).map((stepName, index) => (
            <div key={stepName} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                step === stepName 
                  ? 'bg-blue-600 text-white' 
                  : ['upload', 'processing', 'configure', 'minting'].indexOf(step) > index
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600'
              }`}>
                {index + 1}
              </div>
              <span className={`ml-2 text-sm font-medium ${
                step === stepName ? 'text-blue-600' : 'text-gray-500'
              }`}>
                {stepName === 'upload' && 'Upload'}
                {stepName === 'processing' && 'Processing'}
                {stepName === 'configure' && 'Configure'}
                {stepName === 'minting' && 'Mint'}
              </span>
              {index < 3 && (
                <div className={`w-16 h-0.5 mx-4 ${
                  ['upload', 'processing', 'configure', 'minting'].indexOf(step) > index
                    ? 'bg-green-500'
                    : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-red-500 mr-2">❌</span>
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        {step === 'upload' && (
          <div>
            <h3 className="text-xl font-semibold mb-4">📁 Upload Your Knowledge Source</h3>
            <p className="text-gray-600 mb-6">
              Upload a single file containing your knowledge. Supported formats: TXT, PDF, DOCX, MP4, MOV, MP3, WAV
            </p>
            
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input {...getInputProps()} />
              <div className="text-4xl mb-4">📄</div>
              {isDragActive ? (
                <p className="text-blue-600 font-medium">Drop the file here...</p>
              ) : (
                <div>
                  <p className="text-gray-600 mb-2">
                    Drag & drop a file here, or click to select
                  </p>
                  <p className="text-sm text-gray-500">
                    Maximum 1 file per upload
                  </p>
                </div>
              )}
            </div>

            {uploadedFile && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <span className="text-green-500 mr-2">✅</span>
                  <span className="text-green-700">
                    Selected: {uploadedFile.name} ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'processing' && (
          <div className="text-center py-12">
            <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <h3 className="text-xl font-semibold mb-2">🔄 Processing Your File</h3>
            <p className="text-gray-600 mb-4">
              {uploadedFile?.type.startsWith('video/') && 'Transcribing video...'}
              {uploadedFile?.type.startsWith('audio/') && 'Transcribing audio...'}
              {uploadedFile?.type === 'application/pdf' && 'Extracting text from PDF...'}
              {uploadedFile?.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && 'Extracting text from document...'}
              {uploadedFile?.type === 'text/plain' && 'Processing text file...'}
              {!uploadedFile?.type && 'Processing file...'}
            </p>
            <p className="text-sm text-gray-500">
              This may take a few minutes depending on file size...
            </p>
          </div>
        )}

        {step === 'configure' && processingResult && (
          <div>
            <h3 className="text-xl font-semibold mb-4">⚙️ Configure Your Echo</h3>
            
            {/* Processing Results */}
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-2">✅ Processing Complete</h4>
              <div className="text-sm text-green-700 space-y-1">
                <div>📄 File: {processingResult.fileName}</div>
                <div>🆔 Token ID: {processingResult.tokenId}</div>
                <div>🔑 Knowledge Hash: {processingResult.knowledgeHash.slice(0, 20)}...</div>
              </div>
            </div>

            {/* Configuration Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Echo Name *
                </label>
                <input
                  type="text"
                  value={echoConfig.name}
                  onChange={(e) => setEchoConfig(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter a name for your Echo"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={echoConfig.description}
                  onChange={(e) => setEchoConfig(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what knowledge this Echo contains"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price per Query (PYUSD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={echoConfig.pricePerQuery}
                  onChange={(e) => setEchoConfig(prev => ({ ...prev, pricePerQuery: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Users will pay this amount in PYUSD for each query
                </p>
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={resetWizard}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Start Over
              </button>
              <button
                onClick={handleConfigureSubmit}
                disabled={!echoConfig.name.trim() || !echoConfig.description.trim()}
                className="flex-1 bg-blue-600 text-white py-2 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Confirm & Proceed to Mint
              </button>
            </div>
          </div>
        )}

        {step === 'minting' && processingResult && (
          <div>
            <h3 className="text-xl font-semibold mb-4">🎨 Mint Your Echo NFT</h3>
            
            {/* Echo Summary */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">Echo Summary</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <div><strong>Name:</strong> {echoConfig.name}</div>
                <div><strong>Description:</strong> {echoConfig.description}</div>
                <div><strong>Price per Query:</strong> {echoConfig.pricePerQuery} PYUSD</div>
                <div><strong>Token ID:</strong> {processingResult.tokenId}</div>
              </div>
            </div>

            {/* Mint Component */}
            <MintEcho 
              tokenId={processingResult.tokenId}
              echoName={echoConfig.name}
              echoDescription={echoConfig.description}
              pricePerQuery={echoConfig.pricePerQuery}
              onMintComplete={handleMintComplete}
            />
          </div>
        )}
      </div>
    </div>
  );
};
