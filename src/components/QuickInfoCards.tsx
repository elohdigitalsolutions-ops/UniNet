import React from 'react';
import { Copy, Check } from 'lucide-react';

interface QuickInfoCardsProps {
  deviceId: string | null;
  roleStatusText: string;
  roleSubtext: string;
  roleDotClass: string;
  nodeCount: number;
  onCopyId: () => void;
  copied: boolean;
}

export const QuickInfoCards: React.FC<QuickInfoCardsProps> = ({
  deviceId,
  roleStatusText,
  roleSubtext,
  roleDotClass,
  nodeCount,
  onCopyId,
  copied,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Card 1: Local ID display */}
      <div className="bg-[#151517] border border-[#222] p-5 rounded-lg flex flex-col justify-between shadow-sm">
        <div>
          <h2 class="text-[10px] uppercase text-[#666] font-bold tracking-widest">Local Device Identity</h2>
          <div className="bg-black/40 border border-[#333] rounded p-3 mt-3 flex items-center justify-between">
            <code className="text-indigo-400 font-mono-custom text-sm break-all">
              {deviceId || 'Generating...'}
            </code>
            <button
              onClick={onCopyId}
              disabled={!deviceId}
              className="text-[#666] hover:text-indigo-400 p-1 rounded transition cursor-pointer"
              title="Copy Device ID"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-[#888] leading-relaxed mt-4">
          This unique identifier registers this client in the UniNet global gateway registry.
        </p>
      </div>

      {/* Card 2: Role status display */}
      <div className="bg-[#151517] border border-[#222] p-5 rounded-lg flex flex-col justify-between shadow-sm">
        <div>
          <h2 class="text-[10px] uppercase text-[#666] font-bold tracking-widest">Active Role & Status</h2>
          <div className="mt-3">
            <span className="text-white text-base font-bold tracking-tight">
              {roleStatusText}
            </span>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-[#222] pt-3">
          <span className={`w-2.5 h-2.5 rounded-full ${roleDotClass}`}></span>
          <span className="text-xs text-[#888]">
            {roleSubtext}
          </span>
        </div>
      </div>

      {/* Card 3: Mesh Global registry node count */}
      <div className="bg-[#151517] border border-[#222] p-5 rounded-lg flex flex-col justify-between shadow-sm">
        <div>
          <h2 class="text-[10px] uppercase text-[#666] font-bold tracking-widest">Mesh Global Registry</h2>
          <div className="mt-3">
            <span className="text-white text-2xl font-black font-mono-custom tracking-tight">
              {nodeCount} {nodeCount === 1 ? 'Node' : 'Nodes'}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-[#888] leading-relaxed mt-4">
          Total verified peer endpoints connected directly to the Express gateway.
        </p>
      </div>
    </div>
  );
};
