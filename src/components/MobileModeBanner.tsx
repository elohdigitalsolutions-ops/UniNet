import React from 'react';
import { Smartphone } from 'lucide-react';

interface MobileModeBannerProps {
  isVisible: boolean;
}

export const MobileModeBanner: React.FC<MobileModeBannerProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-lg p-4 text-xs text-indigo-300 flex items-center gap-3 shadow-[0_0_15px_rgba(99,102,241,0.05)]">
      <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 shrink-0">
        <Smartphone className="w-4 h-4" />
      </div>
      <div>
        <span className="font-bold uppercase tracking-wider text-[10px] block text-indigo-400">Mobile Node Tunnel Active</span>
        <span className="text-[#AAA]">
          This client was paired dynamically via QR code. Synchronizing real-time logs and sandbox messages with parent host.
        </span>
      </div>
    </div>
  );
};
