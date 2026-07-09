import React, { useState } from 'react';
import { Share2, Radio } from 'lucide-react';

interface HostConfigurationProps {
  onStartHosting: (allowedClientId: string) => void;
  isOnline: boolean;
}

export const HostConfiguration: React.FC<HostConfigurationProps> = ({
  onStartHosting,
  isOnline,
}) => {
  const [clientIdInput, setClientIdInput] = useState<string>('');

  const handleSubmit = () => {
    let targetId = clientIdInput.trim();
    if (!targetId) {
      targetId = 'ANY';
      setClientIdInput('ANY');
    }
    onStartHosting(targetId);
  };

  return (
    <div className="bg-[#151517] border-l-4 border-emerald-500 rounded-lg p-6 flex flex-col justify-between shadow-sm">
      <div>
        <h2 className="text-emerald-400 font-bold text-lg mb-1 flex items-center gap-2">
          <Share2 className="w-5 h-5" /> Host Configuration
        </h2>
        <p className="text-xs text-[#888] leading-relaxed">
          Initiate a secure broadcast session. Only the specified client ID (or ANY) will be granted access to this node's data streams.
        </p>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 flex flex-col gap-2 w-full">
          <label className="text-[10px] uppercase font-bold text-[#666] tracking-wider">
            Allowed Client ID
          </label>
          <input
            type="text"
            value={clientIdInput}
            onChange={(e) => setClientIdInput(e.target.value)}
            placeholder="Enter peer identifier (e.g. DEV-1234)"
            className="bg-[#0A0A0B] border border-[#333] px-4 py-3 rounded text-sm font-mono-custom text-emerald-400 focus:border-emerald-500 outline-none transition-all w-full placeholder:text-[#444]"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!isOnline}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-6 py-3 rounded text-xs uppercase tracking-wider h-[46px] transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
        >
          <Radio className="w-4 h-4" /> Start Sharing
        </button>
      </div>
    </div>
  );
};
