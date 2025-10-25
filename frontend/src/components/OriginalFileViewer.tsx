import React, { useState } from 'react';
import { contentStorage } from '../services/contentStorage';

interface OriginalFileViewerProps {
  tokenId: number;
  fileName: string;
  contentType: string;
}

export const OriginalFileViewer: React.FC<OriginalFileViewerProps> = ({ 
  tokenId, 
  fileName, 
  contentType 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileUrl = contentStorage.getOriginalFileUrl(tokenId);

  const renderFileViewer = () => {
    // Video files
    if (contentType.startsWith('video/')) {
      return (
        <div className="w-full">
          <video 
            controls 
            className="w-full max-h-96 rounded-lg shadow-lg"
            preload="metadata"
          >
            <source src={fileUrl} type={contentType} />
            Your browser does not support the video tag.
          </video>
          <div className="mt-2 text-sm text-gray-600 text-center">
            📹 {fileName} • {contentType}
          </div>
        </div>
      );
    }

    // Audio files
    if (contentType.startsWith('audio/')) {
      return (
        <div className="w-full">
          <audio 
            controls 
            className="w-full"
            preload="metadata"
          >
            <source src={fileUrl} type={contentType} />
            Your browser does not support the audio tag.
          </audio>
          <div className="mt-2 text-sm text-gray-600 text-center">
            🎵 {fileName} • {contentType}
          </div>
        </div>
      );
    }

    // PDF files
    if (contentType === 'application/pdf') {
      return (
        <div className="w-full">
          <iframe
            src={fileUrl}
            className="w-full h-96 rounded-lg shadow-lg border border-gray-200"
            title={fileName}
          />
          <div className="mt-2 text-sm text-gray-600 text-center">
            📄 {fileName} • PDF Document
          </div>
        </div>
      );
    }

    // Text files
    if (contentType === 'text/plain') {
      return (
        <div className="w-full">
          <iframe
            src={fileUrl}
            className="w-full h-96 rounded-lg shadow-lg border border-gray-200"
            title={fileName}
          />
          <div className="mt-2 text-sm text-gray-600 text-center">
            📝 {fileName} • Text Document
          </div>
        </div>
      );
    }

    // Word documents
    if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return (
        <div className="w-full">
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            <div className="text-6xl mb-4">📄</div>
            <h4 className="text-xl font-semibold text-gray-800 mb-2">Word Document</h4>
            <p className="text-gray-600 mb-4">
              {fileName}
            </p>
            <p className="text-sm text-gray-500">
              Word documents cannot be displayed inline. The content has been processed into the knowledge base above.
            </p>
          </div>
        </div>
      );
    }

    // Images
    if (contentType.startsWith('image/')) {
      return (
        <div className="w-full">
          <img 
            src={fileUrl} 
            alt={fileName}
            className="w-full max-h-96 object-contain rounded-lg shadow-lg"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setError('Failed to load image');
            }}
          />
          <div className="mt-2 text-sm text-gray-600 text-center">
            🖼️ {fileName} • {contentType}
          </div>
        </div>
      );
    }

    // Default fallback
    return (
      <div className="w-full">
        <div className="bg-gray-100 rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">📄</div>
          <h4 className="text-xl font-semibold text-gray-800 mb-2">File Preview</h4>
          <p className="text-gray-600 mb-4">
            {fileName}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            This file type cannot be displayed inline. The content has been processed into the knowledge base above.
          </p>
          <a 
            href={fileUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔗 Open File in New Tab
          </a>
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className="w-full">
        <div className="bg-red-50 rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h4 className="text-xl font-semibold text-red-800 mb-2">Error Loading File</h4>
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => {
              setError(null);
              setIsLoading(true);
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading file...</span>
        </div>
      )}
      {renderFileViewer()}
    </div>
  );
};
