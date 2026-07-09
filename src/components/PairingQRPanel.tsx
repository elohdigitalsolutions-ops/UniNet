import React, { useState } from 'react';
import { QrCode, Copy, Check, ExternalLink } from 'lucide-react';

interface PairingQRPanelProps {
  deviceId: string | null;
  onCopyUrl: () => void;
  copiedUrl: boolean;
  onSimulateMobile: () => void;
}

export const PairingQRPanel: React.FC<PairingQRPanelProps> = ({
  deviceId,
  onCopyUrl,
  copiedUrl,
  onSimulateMobile,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  if (!deviceId) return null;

  // Generate pairing URL:
  // Auto-translate Development URLs to Public Shareable/Preview URLs to avoid the Google Auth wall!
  let pairingUrl = window.location.origin + '/?pair=' + deviceId + '&mode=mobile';
  if (pairingUrl.includes('ais-dev-')) {
    pairingUrl = pairingUrl.replace('ais-dev-', 'ais-pre-');
  }

  const qrImageUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(pairingUrl);

  return (
    <div className="bg-[#151517] border border-[#222] rounded-lg p-6 flex flex-col justify-between shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-indigo-400 animate-pulse" /> Mobile Device Mirroring
          </h2>
          <p className="text-xs text-[#888] leading-relaxed">
            Generate an encrypted tunnel session to connect your mobile phone or another browser tab instantly.
          </p>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2.5 px-4 rounded transition flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <QrCode className="w-4 h-4" /> {isOpen ? 'Collapse QR Link' : 'Generate QR Link'}
        </button>
      </div>

      {isOpen && (
        <div className="mt-5 bg-[#1a1a1c] border border-[#2c2c2f] rounded-lg p-5 flex flex-col items-center justify-center text-center gap-4 transition-all duration-300 shadow-lg">
          <div className="text-xs text-[#888] font-semibold max-w-sm leading-relaxed">
            Scan this code with your phone camera to instantly load{' '}
            <span className="text-indigo-400 font-bold font-mono-custom">UniNet</span> on your mobile device.
            This sets up the automatic handshake bridge!
          </div>
          <div className="p-3 bg-white rounded-lg inline-block shadow-inner shadow-black/40">
            <img
              src={qrImageUrl}
              alt="UniNet Mobile Link QR"
              className="w-40 h-40 object-contain selection:bg-transparent"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          </div>
          <div className="w-full flex flex-col gap-2.5">
            <div className="bg-black/40 border border-[#333] rounded px-3 py-2 flex items-center justify-between text-[11px] font-mono-custom text-[#AAA] overflow-hidden">
              <span className="truncate pr-4 font-mono text-[10px]">
                {pairingUrl}
              </span>
              <button
                onClick={onCopyUrl}
                className="text-[#666] hover:text-white p-1 rounded shrink-0 transition cursor-pointer"
                title="Copy Public URL"
              >
                {copiedUrl ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Fallback Simulator Button */}
            <button
              onClick={onSimulateMobile}
              className="text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 py-2.5 px-3 rounded flex items-center justify-center gap-1.5 transition active:scale-95 w-full cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Simulate Mobile Tab (Same Browser)
            </button>

            <div className="text-[10px] text-[#666] text-left leading-normal border-t border-[#222] pt-2.5 mt-1">
              <span className="text-amber-500 font-bold">⚠️ Mobile Note:</span> Since your current dev environment is private, your phone must be logged in to your Google Account to access this URL directly. Otherwise, use the <strong className="text-[#888]">Simulate Mobile Tab</strong> button above to test side-by-side!
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
