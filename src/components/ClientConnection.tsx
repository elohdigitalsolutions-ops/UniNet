import React, { useState, useEffect } from 'react';
import { Cable, Plug2 } from 'lucide-react';

interface ClientConnectionProps {
  onTapIn: (targetHostId: string) => void;
  isOnline: boolean;
  initialTargetId?: string;
}

export const ClientConnection: React.FC<ClientConnectionProps> = ({
  onTapIn,
  isOnline,
  initialTargetId = '',
}) => {
  const [hostIdInput, setHostIdInput] = useState<string>(initialTargetId);

  useEffect(() => {
    if (initialTargetId) {
      setHostIdInput(initialTargetId);
    }
  }, [initialTargetId]);

  const handleSubmit = () => {
    if (hostIdInput.trim()) {
      onTapIn(hostIdInput.trim());
    }
  };

  return (
    <div className="bg-[#151517] border-l-4 border-blue-500 rounded-lg p-6 flex flex-col justify-between shadow-sm">
      <div>
        <h2 className="text-blue-400 font-bold text-lg mb-1 flex items-center gap-2">
          <Cable className="w-5 h-5" /> Client Connection
        </h2>
        <p className="text-xs text-[#888] leading-relaxed">
          Bridge to a remote host. Enter the host identifier to initiate a WebSocket tunnel and synchronize with the remote switchboard.
        </p>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 flex flex-col gap-2 w-full">
          <label className="text-[10px] uppercase font-bold text-[#666] tracking-wider">
            Target Host ID
          </label>
          <input
            type="text"
            value={hostIdInput}
            onChange={(e) => setHostIdInput(e.target.value)}
            placeholder="Enter destination host identifier"
            className="bg-[#0A0A0B] border border-[#333] px-4 py-3 rounded text-sm font-mono-custom text-blue-400 focus:border-blue-500 outline-none transition-all w-full placeholder:text-[#444]"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!isOnline || !hostIdInput.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-6 py-3 rounded text-xs uppercase tracking-wider h-[46px] transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
        >
          <Plug2 className="w-4 h-4" /> Tap Into Connection
        </button>
      </div>
    </div>
  );
};
