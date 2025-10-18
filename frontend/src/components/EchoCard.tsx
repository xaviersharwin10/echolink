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

export const EchoCard: React.FC<EchoCardProps> = ({ echo, onSelect }) => {
  const { tokenId, name, description, creator, imageUrl, isCreatorActive } =
    echo;

  return (
    <div
      className="echo-card flex flex-col rounded-2xl border border-gray-200 bg-white shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
      style={{ background: generateGradient(tokenId) }}
    >
      <div className="p-5">
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-48 rounded-lg object-cover mb-4"
        />
        <h3 className="text-2xl font-bold text-gray-800">{name}</h3>
        <p className="text-sm text-gray-500 mb-4">ECHO #{tokenId}</p>
        <p className="text-gray-600 text-base mb-5 h-20">{description}</p>
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