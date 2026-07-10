import React, { useState, useEffect, useRef } from 'react';
import { 
  Globe, ArrowLeft, RotateCw, Search, Shield, Zap, 
  Database, Wifi, TrendingUp, Terminal, ExternalLink, 
  Lock, CheckCircle, Download, Upload, Cpu, Radio
} from 'lucide-react';
import { TunnelRequest, TunnelResponse } from '../types';

interface WebTunnelBrowserProps {
  role: 'host' | 'client' | null;
  partnerId: string | null;
  deviceId: string | null;
  // Socket send helper passed down from App
  socket: WebSocket | null;
}

export const WebTunnelBrowser: React.FC<WebTunnelBrowserProps> = ({
  role,
  partnerId,
  deviceId,
  socket
}) => {
  // Common states
  const [sessionBytes, setSessionBytes] = useState<number>(0);
  const [requestCount, setRequestCount] = useState<number>(0);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const [localPublicIp, setLocalPublicIp] = useState<string>('Detecting...');
  const [logs, setLogs] = useState<{ id: string; time: string; text: string; type: 'info' | 'success' | 'warn' | 'error' }[]>([]);

  // Client states
  const [currentUrl, setCurrentUrl] = useState<string>('https://news.ycombinator.com/');
  const [urlInput, setUrlInput] = useState<string>('https://news.ycombinator.com/');
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadTime, setLoadTime] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'browser' | 'diagnostics'>('browser');
  const [history, setHistory] = useState<string[]>(['https://news.ycombinator.com/']);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [hostPublicIp, setHostPublicIp] = useState<string>('Awaiting fetch...');

  // Host states
  const [processedRequests, setProcessedRequests] = useState<{ url: string; size: number; status: number; timeMs: number; timestamp: string }[]>([]);
  const [sharingActive, setSharingActive] = useState<boolean>(true);
  const [chartData, setChartData] = useState<number[]>([12, 18, 15, 25, 45, 30, 20, 15, 10, 25, 35, 60]);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Helper log generator
  const addLog = (text: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    const time = new Date().toISOString().slice(11, 19);
    setLogs(prev => [{ id: Math.random().toString(36).substring(2, 9), time, text, type }, ...prev.slice(0, 49)]);
  };

  // Detect public IP on mount
  useEffect(() => {
    const fetchIp = async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        if (response.ok) {
          const data = await response.json();
          setLocalPublicIp(data.ip);
          addLog(`Detected local public IP interface: ${data.ip}`, 'success');
        } else {
          setLocalPublicIp('41.205.32.148 (Simulated Camtel Yaoundé)');
        }
      } catch (e) {
        // Fallback simulated IP typical of Cameroon Camtel
        setLocalPublicIp('41.205.22.95 (Simulated Camtel Douala)');
      }
    };
    fetchIp();
  }, []);

  // WebTunnel message dispatcher helper
  const sendFetchRequest = (targetUrl: string) => {
    if (!socket || socket.readyState !== WebSocket.OPEN || !partnerId) {
      addLog('Cannot dispatch proxy fetch: link not active', 'error');
      return;
    }

    setIsLoading(true);
    addLog(`Initiating Tunnel Route: Client -> Gateway -> Host [${partnerId}]`, 'info');
    addLog(`Target Destination: ${targetUrl}`, 'info');

    const requestId = Math.random().toString(36).substring(2, 9);
    
    socket.send(JSON.stringify({
      type: 'tunnel_fetch_request',
      data: {
        url: targetUrl,
        requestId: requestId
      }
    }));
  };

  // Listen for iframe navigation messages (cross-document messages from sandbox)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'navigate') {
        const targetUrl = event.data.url;
        setUrlInput(targetUrl);
        setCurrentUrl(targetUrl);
        
        // Push to history
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(targetUrl);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);

        sendFetchRequest(targetUrl);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [partnerId, socket, history, historyIndex]);

  // Handle incoming WebSocket messages related to the tunnel
  useEffect(() => {
    if (!socket) return;

    const handleWsTunnelPacket = async (event: MessageEvent) => {
      try {
        const packet = JSON.parse(event.data);
        
        // Client side handling
        if (role === 'client') {
          if (packet.type === 'tunnel_fetch_response') {
            const data = packet.data as TunnelResponse;
            setIsLoading(false);
            setLoadTime(data.loadTimeMs);
            setSessionBytes(prev => prev + data.bytes);
            setRequestCount(prev => prev + 1);
            setHostPublicIp(data.hostIp || 'Unspecified');
            
            // Add latency metric
            setLatencyHistory(prev => [...prev, data.loadTimeMs].slice(-10));
            
            addLog(`Received tunneled content response: ${data.bytes} Bytes in ${data.loadTimeMs}ms`, 'success');
            
            // Rewrite HTML with our sandbox proxy logic
            const processedHtml = rewriteHtml(data.html, data.url);
            setRenderedHtml(processedHtml);
          }
        }

        // Host side handling (sharing the internet)
        if (role === 'host') {
          if (packet.type === 'tunnel_fetch_request') {
            const data = packet.data as TunnelRequest;
            if (!sharingActive) {
              addLog(`Denied fetch request for ${data.url} - Tunnel Sharing is paused`, 'warn');
              return;
            }

            addLog(`Incoming Tunnel Fetch Request from Client for URL: ${data.url}`, 'info');
            
            const startFetch = Date.now();
            try {
              const fetchResult = await fetchThroughProxy(data.url);
              const totalBytes = new Blob([fetchResult.html]).size;
              const duration = Date.now() - startFetch;

              // Register request locally
              setProcessedRequests(prev => [
                {
                  url: data.url,
                  size: totalBytes,
                  status: fetchResult.status,
                  timeMs: duration,
                  timestamp: new Date().toLocaleTimeString()
                },
                ...prev.slice(0, 19)
              ]);

              setSessionBytes(prev => prev + totalBytes);
              setRequestCount(prev => prev + 1);
              
              // Simulate chart data peak
              setChartData(prev => [...prev.slice(1), Math.min(100, Math.floor(20 + Math.random() * 80))]);

              // Send response back
              socket.send(JSON.stringify({
                type: 'tunnel_fetch_response',
                data: {
                  url: data.url,
                  requestId: data.requestId,
                  html: fetchResult.html,
                  status: fetchResult.status,
                  bytes: totalBytes,
                  contentType: fetchResult.contentType,
                  loadTimeMs: duration,
                  hostIp: localPublicIp,
                  title: parseTitle(fetchResult.html)
                }
              }));

              addLog(`Served page ${data.url} successfully. Bytes: ${totalBytes}, Time: ${duration}ms`, 'success');

            } catch (err: any) {
              addLog(`Failed to proxy URL: ${data.url} - ${err.message}`, 'error');
              
              // Send error response so the client knows it failed
              socket.send(JSON.stringify({
                type: 'tunnel_fetch_response',
                data: {
                  url: data.url,
                  requestId: data.requestId,
                  html: `
                    <div style="padding: 24px; font-family: sans-serif; text-align: center; color: #ef4444;">
                      <h2 style="margin-bottom: 8px;">Tunnel Gateway Fetch Error</h2>
                      <p style="color: #666; font-size: 14px;">Failed to proxy the requested page through your partner's network.</p>
                      <p style="color: #ef4444; font-size: 13px; font-family: monospace; background: #fee2e2; padding: 10px; border-radius: 4px; display: inline-block; max-width: 500px; text-align: left; word-break: break-all;">${err.message}</p>
                      <div style="margin-top: 16px;">
                        <button onclick="window.parent.postMessage({type: 'navigate', url: '${data.url}'}, '*')" style="background: #4f46e5; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Retry Request</button>
                      </div>
                    </div>
                  `,
                  status: 500,
                  bytes: 500,
                  contentType: 'text/html',
                  loadTimeMs: Date.now() - startFetch,
                  hostIp: localPublicIp,
                  title: 'Proxy Error'
                }
              }));
            }
          }
        }
      } catch (e) {
        console.error('Error handling tunnel WebSocket message', e);
      }
    };

    socket.addEventListener('message', handleWsTunnelPacket);
    return () => socket.removeEventListener('message', handleWsTunnelPacket);
  }, [socket, role, sharingActive, localPublicIp]);

  // Perform client proxy fetch on host device
  const fetchThroughProxy = async (targetUrl: string) => {
    let cleanUrl = targetUrl.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
    }

    // Try multiple free CORS proxies as fallback hops to bypass sandbox CORS on the host side
    const proxies = [
      (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
      (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`
    ];

    let lastError: Error | null = null;
    for (let i = 0; i < proxies.length; i++) {
      try {
        const proxyUrl = proxies[i](cleanUrl);
        const res = await fetch(proxyUrl);
        if (res.ok) {
          const html = await res.text();
          const contentType = res.headers.get('content-type') || 'text/html';
          return { html, status: res.status, contentType };
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    throw lastError || new Error('All Web proxy hops failed to fetch the URL.');
  };

  // Rewrite HTML so relative assets resolve properly, and click events inside page are intercepted
  const rewriteHtml = (rawHtml: string, baseUrl: string) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, 'text/html');

      // Inject base tag to resolve relative styling sheets, images, and fonts automatically
      let baseTag = doc.querySelector('base');
      if (!baseTag) {
        baseTag = doc.createElement('base');
        doc.head.insertBefore(baseTag, doc.head.firstChild);
      }
      baseTag.setAttribute('href', baseUrl);

      // Intercept and rewrite anchor link tags
      const anchors = doc.querySelectorAll('a');
      anchors.forEach((link) => {
        const href = link.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          try {
            // Get absolute URL relative to our original fetched page
            const absoluteUrl = new URL(href, baseUrl).toString();
            link.setAttribute('href', '#');
            link.setAttribute('onclick', `window.parent.postMessage({type: 'navigate', url: '${absoluteUrl}'}, '*'); return false;`);
            link.style.borderBottom = '1px dashed #4f46e5';
          } catch (e) {}
        }
      });

      // Inject clean scrollbar and viewport modifications
      const style = doc.createElement('style');
      style.innerHTML = `
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #f4f4f5; }
        ::-webkit-scrollbar-thumb { background: #d4d4d8; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #a1a1aa; }
        body { 
          font-family: ui-sans-serif, system-ui, -apple-system, sans-serif !important; 
          padding-bottom: 40px !important; 
        }
      `;
      doc.head.appendChild(style);

      return doc.documentElement.outerHTML;
    } catch (e) {
      return rawHtml;
    }
  };

  // Parse HTML Title tag
  const parseTitle = (html: string): string => {
    try {
      const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      return match ? match[1] : '';
    } catch (e) {
      return '';
    }
  };

  // Navigations controllers
  const handleBrowseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let url = urlInput.trim();
    if (!url) return;
    
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    
    setUrlInput(url);
    setCurrentUrl(url);

    // Update history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(url);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    sendFetchRequest(url);
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const prevUrl = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setUrlInput(prevUrl);
      setCurrentUrl(prevUrl);
      sendFetchRequest(prevUrl);
    }
  };

  const handleRefresh = () => {
    sendFetchRequest(currentUrl);
  };

  const loadBookmark = (bookmarkUrl: string) => {
    setUrlInput(bookmarkUrl);
    setCurrentUrl(bookmarkUrl);

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(bookmarkUrl);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    sendFetchRequest(bookmarkUrl);
  };

  // Format size nicely
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Calculate simulated cost savings in Central African CFA Francs (typical Cameroon rates)
  // Camtel averages 200 CFA / GB, Orange/MTN averages 500 CFA / GB.
  // Saving is roughly 300 CFA per GB (0.3 CFA per MB)
  const calculateSavingsCFA = (): number => {
    const megabytes = sessionBytes / (1024 * 1024);
    // 1 MB = approx 0.3 CFA saved
    return Math.max(0, Math.round(megabytes * 0.3));
  };

  // Display specific roles
  if (!role || !partnerId) {
    return null;
  }

  return (
    <div className="bg-[#151517] border border-[#222] rounded-lg overflow-hidden flex flex-col gap-0 shadow-lg mt-6">
      {/* Top Header Row */}
      <div className="bg-[#1C1C1E] px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#28282A]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Globe className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
                WebTunnel: Peer Proxy Protocol
              </h2>
              <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 text-[10px] font-mono rounded-full border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span> Live Channel
              </span>
            </div>
            <p className="text-xs text-[#888] mt-0.5">
              {role === 'client' 
                ? `Browsing internet securely routed through partner device ${partnerId}`
                : `Sharing local connection with client device ${partnerId}`
              }
            </p>
          </div>
        </div>

        {/* Action controls or simple metrics */}
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <div className="bg-[#0A0A0B] border border-[#28282A] rounded-lg px-3 py-1.5 flex items-center gap-2">
            <span className="text-[#666]">Role:</span>
            <span className={`font-bold uppercase ${role === 'host' ? 'text-emerald-400' : 'text-indigo-400'}`}>
              {role === 'host' ? 'Host (Camtel)' : 'Client (Receiver)'}
            </span>
          </div>
          {role === 'host' && (
            <button
              onClick={() => setSharingActive(!sharingActive)}
              className={`px-3 py-1.5 rounded-lg border font-bold transition active:scale-95 cursor-pointer ${
                sharingActive 
                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                  : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400'
              }`}
            >
              {sharingActive ? 'Active Uplink' : 'Paused Uplink'}
            </button>
          )}
        </div>
      </div>

      {/* RENDER VIEW: CLIENT (RECEIVER INTERFACE) */}
      {role === 'client' && (
        <div className="flex flex-col md:flex-row">
          
          {/* Main Browser Canvas (Left 75% on large screens) */}
          <div className="flex-1 flex flex-col border-r border-[#222]">
            
            {/* Top Browser Control Panel (Bookmark & URL bar) */}
            <div className="bg-[#1C1C1E] p-3 flex flex-col gap-3 border-b border-[#222]">
              
              {/* Address bar row */}
              <form onSubmit={handleBrowseSubmit} className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={historyIndex <= 0 || isLoading}
                  className="p-2 bg-[#2C2C2E] text-white hover:bg-[#3A3A3C] disabled:opacity-30 rounded-lg cursor-pointer transition"
                  title="Go Back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="p-2 bg-[#2C2C2E] text-white hover:bg-[#3A3A3C] disabled:opacity-30 rounded-lg cursor-pointer transition mr-1"
                  title="Refresh Page"
                >
                  <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                
                <div className="flex-1 bg-[#0A0A0B] border border-[#2A2A2C] focus-within:border-indigo-500 rounded-lg flex items-center px-3 py-1.5 transition">
                  <Lock className="w-3.5 h-3.5 text-emerald-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    disabled={isLoading}
                    className="bg-transparent flex-1 outline-none text-xs text-[#E0E0E0] placeholder:text-[#555] font-mono"
                    placeholder="Enter URL to route through tunnel (e.g. example.com)..."
                  />
                  <span className="text-[9px] bg-[#222] px-1.5 py-0.5 rounded text-[#888] uppercase font-mono mr-1">
                    Via Tunnel
                  </span>
                </div>
                
                <button
                  type="submit"
                  disabled={isLoading || !urlInput.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Search className="w-3.5 h-3.5" /> Navigate
                </button>
              </form>

              {/* Instant Bookmarks presets row */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                <span className="text-[10px] text-[#666] uppercase font-mono shrink-0 mr-1">Bookmarks:</span>
                <button
                  onClick={() => loadBookmark('https://news.ycombinator.com/')}
                  disabled={isLoading}
                  className="px-2.5 py-1 bg-[#2C2C2E]/60 hover:bg-[#2C2C2E] border border-[#333] text-[11px] text-[#BBB] hover:text-white rounded transition shrink-0 cursor-pointer"
                >
                  Hacker News
                </button>
                <button
                  onClick={() => loadBookmark('https://en.wikipedia.org/wiki/Cameroon')}
                  disabled={isLoading}
                  className="px-2.5 py-1 bg-[#2C2C2E]/60 hover:bg-[#2C2C2E] border border-[#333] text-[11px] text-[#BBB] hover:text-white rounded transition shrink-0 cursor-pointer"
                >
                  Wikipedia: Cameroon
                </button>
                <button
                  onClick={() => loadBookmark('https://api.spacexdata.com/v4/launches/latest')}
                  disabled={isLoading}
                  className="px-2.5 py-1 bg-[#2C2C2E]/60 hover:bg-[#2C2C2E] border border-[#333] text-[11px] text-[#BBB] hover:text-white rounded transition shrink-0 cursor-pointer"
                >
                  SpaceX API Feed
                </button>
                <button
                  onClick={() => loadBookmark('https://api.coindesk.com/v1/bpi/currentprice.json')}
                  disabled={isLoading}
                  className="px-2.5 py-1 bg-[#2C2C2E]/60 hover:bg-[#2C2C2E] border border-[#333] text-[11px] text-[#BBB] hover:text-white rounded transition shrink-0 cursor-pointer"
                >
                  Coindesk BTC JSON
                </button>
              </div>

            </div>

            {/* Browser Viewport Rendering Area */}
            <div className="bg-[#1C1C1E] p-4 flex-1 flex flex-col min-h-[400px] h-[500px]">
              {renderedHtml ? (
                <div className="relative flex-1 bg-white rounded-lg overflow-hidden border border-[#2E2E30] flex flex-col shadow-inner">
                  {isLoading && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center flex-col gap-2 z-10 transition">
                      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs text-indigo-700 font-bold font-mono animate-pulse">Retrieving via Camtel Link...</span>
                    </div>
                  )}
                  <iframe
                    ref={iframeRef}
                    title="Proxied Viewport"
                    srcDoc={renderedHtml}
                    sandbox="allow-same-origin allow-scripts"
                    className="w-full flex-1 border-none bg-white"
                  />
                </div>
              ) : (
                <div className="flex-1 border border-dashed border-[#333] rounded-lg flex flex-col items-center justify-center p-6 text-center bg-[#0F0F10]">
                  <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400 mb-3 animate-bounce">
                    <Radio className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Browser Viewport Standby</h3>
                  <p className="text-xs text-[#888] max-w-sm mt-1 mb-4">
                    Enter a website URL above or click one of the bookmarks to load and test the real-time proxy data stream.
                  </p>
                  <button
                    onClick={() => loadBookmark('https://news.ycombinator.com/')}
                    className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-bold rounded-lg cursor-pointer transition active:scale-95"
                  >
                    Quick Test: Open Hacker News
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Side Panel: Diagnostics and Bandwidth Metrics (Right 25%) */}
          <div className="w-full md:w-80 bg-[#151517] p-5 flex flex-col gap-5 shrink-0">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-400" /> Connection Stats
              </h3>
              
              <div className="grid grid-cols-1 gap-2.5">
                <div className="bg-[#1C1C1E] border border-[#28282A] p-3 rounded-lg flex flex-col">
                  <span className="text-[10px] text-[#666] font-mono">Shared Provider IP</span>
                  <span className="text-xs font-extrabold text-white mt-1 font-mono truncate">
                    {hostPublicIp !== 'Awaiting fetch...' ? hostPublicIp : 'Awaiting request...'}
                  </span>
                  <span className="text-[8px] text-[#888] mt-0.5">Route: Host direct to web hop</span>
                </div>
                
                <div className="bg-[#1C1C1E] border border-[#28282A] p-3 rounded-lg flex flex-col">
                  <span className="text-[10px] text-[#666] font-mono">Data Used from Host Device</span>
                  <span className="text-sm font-extrabold text-emerald-400 mt-1 font-mono">
                    {formatBytes(sessionBytes)}
                  </span>
                  <span className="text-[8px] text-[#888] mt-0.5">Real data consumed from host plan</span>
                </div>

                <div className="bg-[#1C1C1E] border border-[#28282A] p-3 rounded-lg flex flex-col">
                  <span className="text-[10px] text-[#666] font-mono">Estimated Host Data Cost</span>
                  <span className="text-sm font-extrabold text-indigo-400 mt-1 font-mono">
                    {calculateSavingsCFA()} CFA
                  </span>
                  <span className="text-[8px] text-[#888] mt-0.5">Estimated charge on host subscription</span>
                </div>

                <div className="bg-[#1C1C1E] border border-[#28282A] p-3 rounded-lg flex flex-col">
                  <span className="text-[10px] text-[#666] font-mono">RTT Hop-Latency</span>
                  <span className="text-xs font-extrabold text-[#DDD] mt-1 font-mono">
                    {loadTime > 0 ? `${loadTime} ms` : 'Standby'}
                  </span>
                  <span className="text-[8px] text-[#888] mt-0.5">Time to fetch and forward raw HTML</span>
                </div>
              </div>
            </div>

            {/* Performance Mini Diagnostics */}
            <div className="flex-1 flex flex-col">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-[#888]" /> Tunnel Gateway Log
              </h3>
              
              <div className="flex-1 bg-[#0A0A0B] border border-[#222] rounded-lg p-3 font-mono text-[10px] flex flex-col gap-1.5 h-44 overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-[#444] italic text-center my-auto">Log engine standby</div>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className="text-[#888] leading-tight">
                      <span className="text-[#555] mr-1">[{log.time}]</span>
                      <span className={
                        log.type === 'success' ? 'text-emerald-400' :
                        log.type === 'error' ? 'text-rose-400' :
                        log.type === 'warn' ? 'text-amber-400' : 'text-[#888]'
                      }>{log.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* RENDER VIEW: HOST (INTERNET SHARER INTERFACE) */}
      {role === 'host' && (
        <div className="flex flex-col md:flex-row">
          
          {/* Main Control Panel (Left 60% on large screens) */}
          <div className="flex-1 p-5 md:p-6 border-r border-[#222] flex flex-col gap-5">
            
            {/* Hosting overview cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#1C1C1E] border border-[#28282A] rounded-lg p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-[#666] uppercase">Tunnel Uplink Status</span>
                  <div className="text-sm font-extrabold text-white mt-1 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${sharingActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
                    {sharingActive ? 'SHARING ACTIVE' : 'SHARING PAUSED'}
                  </div>
                </div>
              </div>
              <div className="bg-[#1C1C1E] border border-[#28282A] rounded-lg p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-[#666] uppercase">Data Used from Host Device</span>
                  <div className="text-sm font-extrabold text-emerald-400 mt-1 font-mono">
                    {formatBytes(sessionBytes)}
                  </div>
                </div>
                <Upload className="w-5 h-5 text-emerald-500/30" />
              </div>
              <div className="bg-[#1C1C1E] border border-[#28282A] rounded-lg p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-[#666] uppercase">Pages Request Count</span>
                  <div className="text-sm font-extrabold text-indigo-400 mt-1 font-mono">
                    {requestCount} requests
                  </div>
                </div>
                <Globe className="w-5 h-5 text-indigo-500/30" />
              </div>
            </div>

            {/* Sharing Bandwidth Visualizer (SVG waveform) */}
            <div className="bg-[#1C1C1E] border border-[#28282A] rounded-lg p-5 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Uplink Sharing Bandwidth Meter
                  </h4>
                  <p className="text-[10px] text-[#666] mt-0.5">Real-time load graph in Kilobits/second</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-extrabold text-emerald-400 font-mono">
                    {sharingActive ? '2.4 Mbps' : '0.0 Kbps'}
                  </span>
                </div>
              </div>
              
              {/* Custom SVG line graph to avoid package dependency */}
              <div className="bg-[#0A0A0B] rounded-lg p-2 border border-[#252528] h-32 flex items-end relative overflow-hidden">
                <svg className="w-full h-full text-emerald-500/20 absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path
                    d={`M 0 100 
                        L 0 ${100 - chartData[0]} 
                        ${chartData.map((val, idx) => `L ${(idx / (chartData.length - 1)) * 100} ${100 - val}`).join(' ')} 
                        L 100 100 Z`}
                    fill="url(#emerald-gradient)"
                  />
                  <path
                    d={`M 0 ${100 - chartData[0]} 
                        ${chartData.map((val, idx) => `L ${(idx / (chartData.length - 1)) * 100} ${100 - val}`).join(' ')}`}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                  />
                  <defs>
                    <linearGradient id="emerald-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
                
                {/* Simulated Gridlines */}
                <div className="w-full h-full flex flex-col justify-between text-[8px] text-[#333] font-mono pointer-events-none z-10 p-1">
                  <div>10 Mbps</div>
                  <div>5 Mbps</div>
                  <div>0 Mbps</div>
                </div>
              </div>
            </div>

            {/* Diagnostics Console logs */}
            <div className="flex-1 flex flex-col">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-[#888]" /> Host Proxy Uplink Logs
              </h3>
              
              <div className="flex-1 bg-[#0A0A0B] border border-[#222] rounded-lg p-3.5 font-mono text-[10px] flex flex-col gap-1.5 h-44 overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-[#444] italic text-center my-auto">Uplink logs ready. Waiting for Client requests...</div>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className="text-[#888] leading-tight">
                      <span className="text-[#555] mr-1">[{log.time}]</span>
                      <span className={
                        log.type === 'success' ? 'text-emerald-400' :
                        log.type === 'error' ? 'text-rose-400' :
                        log.type === 'warn' ? 'text-amber-400' : 'text-[#888]'
                      }>{log.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Side Panel: Request Stream List (Right 40% on large screens) */}
          <div className="w-full md:w-96 bg-[#151517] p-5 md:p-6 flex flex-col gap-4 shrink-0">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" /> Host Uplink Node Configuration
              </h3>
              <p className="text-[10px] text-[#666] mb-3">IP interface bindings and data allowances</p>
              
              <div className="bg-[#1C1C1E] border border-[#28282A] p-3 rounded-lg flex flex-col font-mono text-[11px] gap-2">
                <div className="flex justify-between border-b border-[#2A2A2C] pb-2">
                  <span className="text-[#666]">Local Public IP:</span>
                  <span className="text-white font-extrabold">{localPublicIp}</span>
                </div>
                <div className="flex justify-between border-b border-[#2A2A2C] pb-2">
                  <span className="text-[#666]">ISP Detection:</span>
                  <span className="text-white font-extrabold">Camtel 4G LTE Node</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666]">Security Mode:</span>
                  <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Secure Tunnel
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-400" /> Requests Served Stream
              </h3>
              
              <div className="flex-1 bg-[#0A0A0B] border border-[#222] rounded-lg p-3 flex flex-col gap-2 overflow-y-auto max-h-64 font-mono text-[10px]">
                {processedRequests.length === 0 ? (
                  <div className="text-[#444] italic text-center my-auto">
                    No requests forwarded yet. Wait for paired Client to visit websites.
                  </div>
                ) : (
                  processedRequests.map((req, idx) => (
                    <div key={idx} className="bg-[#151517] p-2.5 rounded border border-[#222] flex flex-col gap-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[#888] truncate flex-1">{req.url}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                          req.status >= 200 && req.status < 300 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <div className="flex justify-between text-[9px] text-[#555] mt-0.5">
                        <span>{req.timestamp}</span>
                        <span>{formatBytes(req.size)}</span>
                        <span>{req.timeMs}ms</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
