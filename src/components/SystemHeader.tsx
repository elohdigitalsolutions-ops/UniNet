import React, { useEffect, useState } from 'react';
import { ConnectionStatus } from '../types';

interface SystemHeaderProps {
  connectionStatus: ConnectionStatus;
}

export const SystemHeader: React.FC<SystemHeaderProps> = ({ connectionStatus }) => {
  const [timeStr, setTimeStr] = useState<string>('--:--:-- UTC');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeStr(now.toISOString().slice(11, 19) + ' UTC');
    };
    
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const isOnline = connectionStatus === 'ONLINE';

  return (
    <header className="h-16 border-b border-[#222] bg-[#111] flex items-center justify-between px-6 shrink-0 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 bg-indigo-600 flex items-center justify-center font-bold text-white text-xs rounded shadow">
          UN
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
            UniNet <span className="text-[#666] font-normal text-xs font-mono-custom">v1.0.4-SKELETON</span>
          </h1>
        </div>
      </div>

      <div className="flex gap-6 items-center">
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-[10px] uppercase text-[#666] font-semibold tracking-widest">System Status</span>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              {isOnline && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            </span>
            <span className={`font-mono-custom text-xs ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
              {connectionStatus}
            </span>
          </div>
        </div>

        <div className="hidden md:flex flex-col items-end border-l border-[#222] pl-6">
          <span className="text-[10px] uppercase text-[#666] font-semibold tracking-widest font-mono-custom">System Clock</span>
          <span className="text-white font-mono-custom text-xs">{timeStr}</span>
        </div>
      </div>
    </header>
  );
};
