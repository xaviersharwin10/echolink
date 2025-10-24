import React, { useState } from "react";

// Define the structure of an Echo's data
export interface EchoInfo {
  tokenId: number;
  creator: string;
  owner: string;
  name: string;
  description: string;
  imageUrl: string;
  isCreatorActive?: boolean;
  totalQueries: number; 
  pricePerQuery: bigint;
}

interface EchoCardProps {
  echo: EchoInfo;
  onSelect: (tokenId: bigint) => void;
}

const generateGradient = (tokenId: number): string => {
  const hue1 = (tokenId * 137.5) % 360;
  const hue2 = (hue1 + 40) % 360;
  return `linear-gradient(145deg, hsl(${hue1}, 80%, 97%), hsl(${hue2}, 80%, 97%))`;
};

const ActiveCreatorBadge: React.FC = () => (
  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
    ✅ Active Creator
  </span>
);

const formatPrice = (price: bigint): string => {
  return (Number(price) / 1e6).toFixed(2);
};


export const EchoCard: React.FC<EchoCardProps> = ({ echo, onSelect }) => {
  const { tokenId, name, description, creator, isCreatorActive, totalQueries, pricePerQuery } = echo;
  const [isHovered, setIsHovered] = useState(false);

  const formattedPrice = formatPrice(pricePerQuery);

  return (
    <div
      className="echo-card flex flex-col rounded-2xl border border-gray-200/50 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:scale-105 group cursor-pointer"
      style={{ background: generateGradient(tokenId) }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header with animated background */}
      <div className="relative p-5 overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 transition-opacity duration-500 ${isHovered ? 'opacity-100' : 'opacity-0'}`}></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-bold text-gray-800 group-hover:text-gray-900 transition-colors duration-300">{name}</h3>
            <div className={`w-3 h-3 rounded-full transition-all duration-300 ${isCreatorActive ? 'bg-green-400 animate-pulse' : 'bg-gray-300'}`}></div>
          </div>
          <p className="text-sm text-gray-500 mb-4 font-mono">ECHO #{tokenId}</p>
          <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">{description}</p>
        </div>
      </div>

      {/* Stats Section with enhanced animation */}
      <div className="px-5 pb-4">
        <div className={`flex justify-between items-center bg-white/70 backdrop-blur-sm p-4 rounded-xl border border-gray-300/50 shadow-inner transition-all duration-300 ${isHovered ? 'bg-white/90 scale-105' : ''}`}>
          {/* Total Queries */}
          <div className="text-center">
            <p className="text-2xl font-extrabold text-purple-700 transition-transform duration-300 group-hover:scale-110">
              {totalQueries}
            </p>
            <p className="text-xs font-semibold uppercase text-gray-500 tracking-wider">
              Queries
            </p>
          </div>
          {/* Divider */}
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-gray-300 to-transparent"></div>
          {/* Price per Query */}
          <div className="text-center">
            <p className="text-2xl font-extrabold text-green-700 transition-transform duration-300 group-hover:scale-110">
              ${formattedPrice}
            </p>
            <p className="text-xs font-semibold uppercase text-gray-500 tracking-wider">
              Per Query
            </p>
          </div>
        </div>
      </div>

      {/* Footer with enhanced button */}
      <div className="mt-auto p-5 border-t border-gray-200/50 bg-white/60 backdrop-blur-sm rounded-b-2xl">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Creator
            </p>
            {isCreatorActive && <ActiveCreatorBadge />}
          </div>
          <p
            className="text-sm font-mono text-gray-700 truncate hover:text-gray-900 transition-colors duration-300"
            title={creator}
          >
            {creator}
          </p>
        </div>
        <button
          onClick={() => onSelect(BigInt(tokenId))}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 group/btn"
        >
          <span className="flex items-center justify-center">
            Chat with Echo
            <svg className="ml-2 w-4 h-4 transition-transform duration-300 group-hover/btn:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
};