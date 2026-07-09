import React, { useState, useRef, useEffect } from 'react';
import { Zap, Send, Ban } from 'lucide-react';
import { ChatMessage } from '../types';

interface RelaySandboxProps {
  isActive: boolean;
  partnerId: string | null;
  chatMessages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onTerminateLink: () => void;
}

export const RelaySandbox: React.FC<RelaySandboxProps> = ({
  isActive,
  partnerId,
  chatMessages,
  onSendMessage,
  onTerminateLink,
}) => {
  const [chatInput, setChatInput] = useState<string>('');
  const chatStreamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatStreamRef.current) {
      chatStreamRef.current.scrollTop = chatStreamRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSend = () => {
    const text = chatInput.trim();
    if (!text) return;
    onSendMessage(text);
    setChatInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div
      id="sandbox-card"
      className={`bg-[#151517] border-l-4 rounded-lg p-6 flex flex-col gap-4 transition-all duration-300 shadow-sm ${
        isActive
          ? 'border-indigo-500 opacity-100'
          : 'border-slate-700 opacity-40 pointer-events-none'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-4">
          <div
            className={`p-2.5 rounded-lg shrink-0 ${
              isActive ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-500/10 text-slate-400'
            }`}
          >
            <Zap className={`w-5 h-5 ${isActive ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {isActive ? 'Active Relay Sandbox' : 'Relay Sandbox Idle'}
            </h3>
            <p className="text-xs text-[#888] mt-1">
              {isActive
                ? `Secured dynamic tunnel link active with partner Device: ${partnerId}`
                : 'No active device link established. Register as host or client to test real-time relays.'}
            </p>
          </div>
        </div>
        {isActive && (
          <button
            onClick={onTerminateLink}
            className="py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 text-rose-400 rounded text-xs font-mono-custom transition active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <Ban className="w-3 h-3" /> Term Link
          </button>
        )}
      </div>

      {/* Chat Sandbox Messaging */}
      <div className="flex flex-col gap-3 mt-2">
        <div
          ref={chatStreamRef}
          className="border border-[#222] bg-[#0A0A0B] rounded p-4 h-44 overflow-y-auto flex flex-col gap-2 font-mono-custom text-xs"
        >
          {chatMessages.length === 0 ? (
            <div className="text-[#666] text-center italic my-auto">
              Await Link handshake validation
            </div>
          ) : (
            chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`p-2.5 rounded border border-[#222] ${
                  msg.isSelf ? 'bg-indigo-950/20 text-indigo-300' : 'bg-black/30 text-[#E0E0E0]'
                } ${msg.customStyle || ''}`}
              >
                <span className="font-bold text-[10px] block text-[#666] mb-0.5 font-mono-custom">
                  {msg.sender}:
                </span>
                <span>{msg.text}</span>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isActive}
            placeholder={
              isActive
                ? 'Send real-time frame or data packet...'
                : 'Sandbox offline'
            }
            className="flex-1 bg-[#0A0A0B] border border-[#333] focus:border-indigo-500 rounded px-3 py-2 text-xs font-mono-custom text-[#E0E0E0] placeholder:text-[#444] outline-none transition disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!isActive || !chatInput.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
          >
            Send <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
