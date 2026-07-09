import React, { useRef, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { LogEntry } from '../types';

interface SystemLogsConsoleProps {
  logs: LogEntry[];
  onClear: () => void;
  isOnline: boolean;
}

export const SystemLogsConsole: React.FC<SystemLogsConsoleProps> = ({
  logs,
  onClear,
  isOnline,
}) => {
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const getLogStyle = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return { colorClass: 'text-emerald-500', prefix: '🟢' };
      case 'error':
        return { colorClass: 'text-rose-500 font-bold', prefix: '🔴' };
      case 'incoming':
        return { colorClass: 'text-blue-400', prefix: '📥' };
      case 'outgoing':
        return { colorClass: 'text-indigo-400', prefix: '📤' };
      case 'warn':
        return { colorClass: 'text-amber-500 font-semibold', prefix: '⚠️' };
      default:
        return { colorClass: 'text-[#666]', prefix: '⚙️' };
    }
  };

  return (
    <div className="lg:col-span-5 flex flex-col min-h-[450px]">
      <div className="bg-[#0d0d0e] border border-[#222] rounded-lg flex-1 flex flex-col overflow-hidden shadow-lg">
        {/* Terminal Header */}
        <div className="bg-[#111] px-4 py-3 border-b border-[#222] flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500/70"></span>
              <span className="w-2 h-2 rounded-full bg-amber-500/70"></span>
              <span className="w-2 h-2 rounded-full bg-emerald-500/70"></span>
            </div>
            <span className="text-[10px] bg-[#222] text-[#AAA] px-2 py-0.5 rounded uppercase font-bold font-mono-custom tracking-wider">
              Live Traffic
            </span>
          </div>

          <button
            onClick={onClear}
            className="text-[10px] font-mono-custom text-[#555] hover:text-[#AAA] transition flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" /> Clear
          </button>
        </div>

        {/* Terminal Stream Logs */}
        <div className="flex-1 p-4 overflow-y-auto font-mono-custom text-[11px] space-y-2 flex flex-col bg-[#0A0A0B]/90">
          <div className="flex-1" />
          {logs.map((log) => {
            const { colorClass, prefix } = getLogStyle(log.type);
            return (
              <div key={log.id} className="leading-relaxed hover:bg-white/5 p-0.5 rounded transition duration-150">
                <span className="text-[#444] select-none mr-2 font-mono">
                  [{log.timestamp}]
                </span>
                <span className="mr-1.5">{prefix}</span>
                <span className={colorClass}>{log.message}</span>
              </div>
            );
          })}
          <div ref={consoleEndRef} />
        </div>

        {/* System Metrics footer */}
        <div className="bg-[#0A0A0B] px-4 py-2.5 border-t border-[#222] flex justify-between items-center text-[10px] font-mono-custom text-[#555]">
          <span>WS_LISTENER: PORT 3000</span>
          <span>
            {isOnline ? (
              <span className="text-emerald-500/80">MESH STATUS: NOMINAL</span>
            ) : (
              <span className="text-rose-500/80">MESH STATUS: RETRYING...</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};
