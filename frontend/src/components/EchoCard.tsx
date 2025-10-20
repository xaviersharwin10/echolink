import React from "react";

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

  const formattedPrice = formatPrice(pricePerQuery);

  return (
    <div
      className="echo-card flex flex-col rounded-2xl border border-gray-200 shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
      style={{ background: generateGradient(tokenId) }}
    >
      <div className="p-5">
        <h3 className="text-2xl font-bold text-gray-800">{name}</h3>
        <p className="text-sm text-gray-500 mb-4">ECHO #{tokenId}</p>

        {/* Description */}
        <p className="text-gray-600 text-base">{description}</p>
      </div>

      <div className="px-5 pb-4">
        <div className="flex justify-between items-center bg-white/60 p-3 rounded-xl border border-gray-300/50 backdrop-blur-sm shadow-inner">
          {/* Total Queries (Blockscout Verified) */}
          <div className="text-center">
            <p className="text-xl font-extrabold text-purple-700">
              {totalQueries}
            </p>
            <p className="text-xs font-semibold uppercase text-gray-500 tracking-wider">
              Queries
            </p>
          </div>
          {/* Divider */}
          <div className="w-px h-8 bg-gray-300/80"></div>
          {/* Price per Query */}
          <div className="text-center">
            <p className="text-xl font-extrabold text-green-700">
              ${formattedPrice}
            </p>
            <p className="text-xs font-semibold uppercase text-gray-500 tracking-wider">
              Price per Query
            </p>
          </div>
        </div>
      </div>

      <div className="mt-auto p-5 border-t border-gray-200 bg-white/50 rounded-b-2xl">
        <div className="mb-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Creator
            </p>
            {isCreatorActive && <ActiveCreatorBadge />}
          </div>
          <p
            className="text-sm font-mono text-gray-700 truncate"
            title={creator}
          >
            {creator}
          </p>
        </div>
        <button
          onClick={() => onSelect(BigInt(tokenId))}
          className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
        >
          Chat with Echo →
        </button>
      </div>
    </div>
  );
};