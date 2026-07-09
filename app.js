import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const app = express();
const PORT = 3000;

// Device Registry Map to track connected WebSocket clients
// Schema: deviceId -> { ws, status: 'idle'|'hosting'|'connected', role: 'host'|'client'|null, partnerId: string|null, allowedClientId: string|null }
const deviceRegistry = new Map();

// Serve the frontend dashboard UI directly from the root path
app.get('/', (req, res) => {
  res.send(`
<!doctype html>
<html lang="en" class="h-full">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>UniNet - Universal Device Mesh Skeleton</title>
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Lucide Icons for high-fidelity UI -->
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
      body {
        font-family: 'Inter', sans-serif;
      }
      .font-mono-custom {
        font-family: 'JetBrains Mono', monospace;
      }
      /* Custom glowing scrollbars */
      ::-webkit-scrollbar {
        width: 5px;
        height: 5px;
      }
      ::-webkit-scrollbar-track {
        background: #0A0A0B;
      }
      ::-webkit-scrollbar-thumb {
        background: #222;
        border-radius: 2px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #333;
      }
    </style>
  </head>
  <body class="bg-[#0A0A0B] text-[#E0E0E0] min-h-screen flex flex-col selection:bg-indigo-600 selection:text-white">
    
    <!-- Top Header / System Status Bar -->
    <header class="h-16 border-b border-[#222] bg-[#111] flex items-center justify-between px-6 shrink-0 sticky top-0 z-50">
      <div class="flex items-center gap-4">
        <div class="w-8 h-8 bg-indigo-600 flex items-center justify-center font-bold text-white text-xs rounded shadow">UN</div>
        <div>
          <h1 class="text-base font-bold tracking-tight text-white flex items-center gap-2">
            UniNet <span class="text-[#666] font-normal text-xs font-mono-custom">v1.0.4-SKELETON</span>
          </h1>
        </div>
      </div>

      <!-- Live metrics and clocks -->
      <div class="flex gap-6 items-center">
        <div class="hidden sm:flex flex-col items-end">
          <span class="text-[10px] uppercase text-[#666] font-semibold tracking-widest">System Status</span>
          <div class="flex items-center gap-2">
            <span class="relative flex h-2 w-2">
              <span id="ping-indicator-pulse" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span id="ping-indicator" class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span id="status-badge" class="text-emerald-400 font-mono-custom text-xs">ONLINE</span>
          </div>
        </div>

        <div class="hidden md:flex flex-col items-end border-l border-[#222] pl-6">
          <span class="text-[10px] uppercase text-[#666] font-semibold tracking-widest font-mono-custom">System Clock</span>
          <span id="clock" class="text-white font-mono-custom text-xs">--:--:-- UTC</span>
        </div>
      </div>
    </header>

    <!-- Main Dashboard Grid -->
    <main class="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      
      <!-- Mobile Pairing Mode Active Banner -->
      <div id="mobile-mode-banner" class="hidden bg-indigo-950/40 border border-indigo-500/30 rounded-lg p-4 text-xs text-indigo-300 items-center gap-3 shadow-[0_0_15px_rgba(99,102,241,0.05)]">
        <div class="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 shrink-0">
          <i data-lucide="smartphone" class="w-4 h-4"></i>
        </div>
        <div>
          <span class="font-bold uppercase tracking-wider text-[10px] block text-indigo-400">Mobile Node Tunnel Active</span>
          <span class="text-[#AAA]">This client was paired dynamically via QR code. Synchronizing real-time logs and sandbox messages with parent host.</span>
        </div>
      </div>
      
      <!-- Top Row Quick Info Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <!-- Card 1: Local ID display -->
        <div class="bg-[#151517] border border-[#222] p-5 rounded-lg flex flex-col justify-between shadow-sm">
          <div>
            <h2 class="text-[10px] uppercase text-[#666] font-bold tracking-widest">Local Device Identity</h2>
            <div class="bg-black/40 border border-[#333] rounded p-3 mt-3 flex items-center justify-between">
              <code class="text-indigo-400 font-mono-custom text-sm break-all" id="local-id-display">Generating...</code>
              <button onclick="copyDeviceId()" class="text-[#666] hover:text-indigo-400 p-1 rounded transition" title="Copy Device ID">
                <i data-lucide="copy" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
          <p class="text-[11px] text-[#888] leading-relaxed mt-4">
            This unique identifier registers this client in the UniNet global gateway registry.
          </p>
        </div>

        <!-- Card 2: Role status display -->
        <div class="bg-[#151517] border border-[#222] p-5 rounded-lg flex flex-col justify-between shadow-sm">
          <div>
            <h2 class="text-[10px] uppercase text-[#666] font-bold tracking-widest">Active Role & Status</h2>
            <div class="mt-3">
              <span id="role-status-display" class="text-white text-base font-bold tracking-tight">Idle / Standard Client</span>
            </div>
          </div>
          <div class="mt-4 flex items-center gap-2 border-t border-[#222] pt-3">
            <span class="w-2.5 h-2.5 rounded-full bg-slate-600" id="role-dot"></span>
            <span class="text-xs text-[#888]" id="role-subtext">Waiting for custom protocol command</span>
          </div>
        </div>

        <!-- Card 3: Mesh Global registry node count -->
        <div class="bg-[#151517] border border-[#222] p-5 rounded-lg flex flex-col justify-between shadow-sm">
          <div>
            <h2 class="text-[10px] uppercase text-[#666] font-bold tracking-widest">Mesh Global Registry</h2>
            <div class="mt-3">
              <span id="mesh-nodes-display" class="text-white text-2xl font-black font-mono-custom tracking-tight">1 Node</span>
            </div>
          </div>
          <p class="text-[11px] text-[#888] leading-relaxed mt-4">
            Total verified peer endpoints connected directly to the Express gateway.
          </p>
        </div>

      </div>

      <!-- Core Configuration Bento Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- Interactive Controls (Left Side, 7 Columns) -->
        <div class="lg:col-span-7 flex flex-col gap-6">
          
          <!-- QR Link Generator (High Density Theme) -->
          <div class="flex flex-col gap-3">
            <button id="qr-toggle-btn" onclick="toggleQrCode()" class="group relative overflow-hidden bg-[#151517] border border-[#222] hover:border-indigo-500/50 rounded-lg p-3.5 flex items-center justify-between transition-all duration-300 cursor-pointer shadow-md select-none w-full shadow-[0_0_15px_rgba(99,102,241,0.05)] hover:shadow-[0_0_20px_rgba(99,102,241,0.2)]">
              <div class="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div class="flex items-center gap-3 relative z-10">
                <div class="relative flex h-3 w-3">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                </div>
                <div class="text-left">
                  <span class="text-xs font-bold text-white uppercase tracking-wider block">Scan QR Code for Mobile Link</span>
                  <span class="text-[10px] text-[#888] font-mono-custom group-hover:text-indigo-300 transition-colors">Generate direct, public mobile connection bridge</span>
                </div>
              </div>
              <div class="flex items-center gap-2 text-indigo-400 font-mono-custom text-xs relative z-10">
                <span class="text-[10px] bg-indigo-950 text-indigo-400 px-2 py-0.5 rounded font-bold border border-indigo-900/30">MOBILE TUNNEL</span>
                <i data-lucide="qr-code" class="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform"></i>
              </div>
            </button>

            <!-- Collapsible QR Code Panel -->
            <div id="qr-panel" class="hidden bg-[#151517] border border-[#222] rounded-lg p-5 flex-col items-center justify-center text-center gap-4 transition-all duration-300 shadow-lg">
              <div class="text-xs text-[#888] font-semibold max-w-sm leading-relaxed">
                Scan this code with your phone camera to instantly load <span class="text-indigo-400 font-bold font-mono-custom">UniNet</span> on your mobile device. This sets up the automatic handshake bridge!
              </div>
              <div class="p-3 bg-white rounded-lg inline-block shadow-inner shadow-black/40">
                <img id="qr-image" src="" alt="UniNet Mobile Link QR" class="w-40 h-40 object-contain selection:bg-transparent" referrerPolicy="no-referrer" loading="lazy" />
              </div>
              <div class="w-full flex flex-col gap-2.5">
                <div class="bg-black/40 border border-[#333] rounded px-3 py-2 flex items-center justify-between text-[11px] font-mono-custom text-[#AAA] overflow-hidden">
                  <span class="truncate pr-4 font-mono text-[10px]" id="qr-current-url">Loading...</span>
                  <button onclick="copyCurrentUrl()" class="text-[#666] hover:text-white p-1 rounded shrink-0 transition" title="Copy Public URL">
                    <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                  </button>
                </div>
                
                <!-- Fallback Simulator Button -->
                <button onclick="simulateMobileTab()" class="text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 py-2.5 px-3 rounded flex items-center justify-center gap-1.5 transition active:scale-95 w-full cursor-pointer">
                  <i data-lucide="external-link" class="w-3.5 h-3.5"></i> Simulate Mobile Tab (Same Browser)
                </button>
                
                <div class="text-[10px] text-[#666] text-left leading-normal border-t border-[#222] pt-2.5 mt-1">
                  <span class="text-amber-500 font-bold">⚠️ Mobile Note:</span> Since your current dev environment is private, your phone must be logged in to your Google Account to access this URL directly. Otherwise, use the <strong class="text-[#888]">Simulate Mobile Tab</strong> button above to test side-by-side!
                </div>
              </div>
            </div>
          </div>

          <!-- Host Sharing Panel (Green Accent border-l-4) -->
          <div class="bg-[#151517] border-l-4 border-emerald-500 rounded-lg p-6 flex flex-col justify-between shadow-sm">
            <div>
              <h2 class="text-emerald-400 font-bold text-lg mb-1 flex items-center gap-2">
                <i data-lucide="share-2" class="w-5 h-5"></i> Host Configuration
              </h2>
              <p class="text-xs text-[#888] leading-relaxed">Initiate a secure broadcast session. Only the specified client ID will be granted access to this node's data streams.</p>
            </div>
            
            <div class="mt-6 flex flex-col sm:flex-row gap-4 items-end">
              <div class="flex-1 flex flex-col gap-2 w-full">
                <label class="text-[10px] uppercase font-bold text-[#666] tracking-wider">Allowed Client ID</label>
                <input id="allowed-client-id" type="text" placeholder="Enter peer identifier (e.g. DEV-1234)" class="bg-[#0A0A0B] border border-[#333] px-4 py-3 rounded text-sm font-mono-custom text-emerald-400 focus:border-emerald-500 outline-none transition-all w-full placeholder:text-[#444]">
              </div>
              <button onclick="startHosting()" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded text-xs uppercase tracking-wider h-[46px] transition-all flex items-center gap-1.5 shrink-0 active:scale-95">
                <i data-lucide="radio" class="w-4 h-4"></i> Start Sharing
              </button>
            </div>
          </div>

          <!-- Client Tap-In Panel (Blue Accent border-l-4) -->
          <div class="bg-[#151517] border-l-4 border-blue-500 rounded-lg p-6 flex flex-col justify-between shadow-sm">
            <div>
              <h2 class="text-blue-400 font-bold text-lg mb-1 flex items-center gap-2">
                <i data-lucide="cable" class="w-5 h-5"></i> Client Connection
              </h2>
              <p class="text-xs text-[#888] leading-relaxed">Bridge to a remote host. Enter the host identifier to initiate a WebSocket tunnel and synchronize with the remote switchboard.</p>
            </div>
            
            <div class="mt-6 flex flex-col sm:flex-row gap-4 items-end">
              <div class="flex-1 flex flex-col gap-2 w-full">
                <label class="text-[10px] uppercase font-bold text-[#666] tracking-wider">Target Host ID</label>
                <input id="target-host-id" type="text" placeholder="Enter destination host identifier" class="bg-[#0A0A0B] border border-[#333] px-4 py-3 rounded text-sm font-mono-custom text-blue-400 focus:border-blue-500 outline-none transition-all w-full placeholder:text-[#444]">
              </div>
              <button onclick="tapIn()" class="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded text-xs uppercase tracking-wider h-[46px] transition-all flex items-center gap-1.5 shrink-0 active:scale-95">
                <i data-lucide="plug-2" class="w-4 h-4"></i> Tap Into Connection
              </button>
            </div>
          </div>

          <!-- Active Relay Sandbox (Collapsible / Active Only, Indigo Accent) -->
          <div id="sandbox-card" class="bg-[#151517] border-l-4 border-slate-700 rounded-lg p-6 flex flex-col gap-4 opacity-40 pointer-events-none transition-all duration-300 shadow-sm">
            <div class="flex items-start justify-between gap-4">
              <div class="flex gap-4">
                <div class="p-2.5 bg-indigo-500/10 rounded-lg text-indigo-400 shrink-0" id="sandbox-icon-box">
                  <i data-lucide="zap" class="w-5 h-5" id="sandbox-icon"></i>
                </div>
                <div>
                  <h3 class="text-sm font-bold text-white uppercase tracking-wider" id="sandbox-title">Active Relay Sandbox</h3>
                  <p class="text-xs text-[#888] mt-1" id="sandbox-description">No active device link established. Register as host or client to test real-time relays.</p>
                </div>
              </div>
              <button onclick="terminateLink()" id="disconnect-btn" class="hidden py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 text-rose-400 rounded text-xs font-mono-custom transition active:scale-95">
                Term Link
              </button>
            </div>

            <!-- Chat Sandbox Messaging -->
            <div class="flex flex-col gap-3 mt-2">
              <div class="border border-[#222] bg-[#0A0A0B] rounded p-4 h-44 overflow-y-auto flex flex-col gap-2 font-mono-custom text-xs" id="chat-stream">
                <div class="text-[#666] text-center italic my-auto">Await Link handshake validation</div>
              </div>

              <div class="flex gap-2">
                <input id="chat-input" type="text" placeholder="Send real-time frame or data packet..." class="flex-1 bg-[#0A0A0B] border border-[#333] focus:border-indigo-500 rounded px-3 py-2 text-xs font-mono-custom text-[#E0E0E0] placeholder:text-[#444] outline-none transition" />
                <button onclick="sendChatMessage()" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded transition active:scale-95 flex items-center justify-center gap-1">
                  Send <i data-lucide="send" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>
          </div>

        </div>

        <!-- System Logs Console (Right Side, 5 Columns) -->
        <div class="lg:col-span-5 flex flex-col min-h-[450px]">
          <div class="bg-[#0d0d0e] border border-[#222] rounded-lg flex-1 flex flex-col overflow-hidden shadow-lg">
            
            <!-- Terminal Header -->
            <div class="bg-[#111] px-4 py-3 border-b border-[#222] flex justify-between items-center">
              <div class="flex items-center gap-2">
                <div class="flex gap-1">
                  <span class="w-2 h-2 rounded-full bg-rose-500/70"></span>
                  <span class="w-2 h-2 rounded-full bg-amber-500/70"></span>
                  <span class="w-2 h-2 rounded-full bg-emerald-500/70"></span>
                </div>
                <span class="text-[10px] bg-[#222] text-[#AAA] px-2 py-0.5 rounded uppercase font-bold font-mono-custom tracking-wider">Live Traffic</span>
              </div>
              
              <button onclick="clearConsoleLogs()" class="text-[10px] font-mono-custom text-[#555] hover:text-[#AAA] transition flex items-center gap-1">
                <i data-lucide="trash-2" class="w-3 h-3"></i> Clear
              </button>
            </div>

            <!-- Terminal Stream Logs -->
            <div id="console-stream" class="flex-1 p-4 overflow-y-auto font-mono-custom text-[11px] space-y-2 flex flex-col justify-end">
              <!-- Logs will append here -->
            </div>
            
            <!-- System Metrics footer -->
            <div class="bg-[#0A0A0B] px-4 py-2.5 border-t border-[#222] flex justify-between items-center text-[10px] font-mono-custom text-[#555]">
              <span>WS_LISTENER: PORT 3000</span>
              <span id="socket-reconnect-status">MESH STATUS: NOMINAL</span>
            </div>
          </div>
        </div>

      </div>
    </main>

    <!-- Global Footer -->
    <footer class="border-t border-[#222] bg-[#0A0A0B] py-4 px-6 mt-8">
      <div class="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-[#555] font-mono-custom">
        <span>UniNet Mesh Platform Design System // High Density Theme</span>
        <span>Secure Peer Network Node Sandbox</span>
      </div>
    </footer>

    <!-- Client Script Logic -->
    <script>
      let socket = null;
      let myDeviceId = null;
      let activePeerId = null;
      let currentRole = null; // 'host' or 'client'

      // Initialize Lucide icons
      lucide.createIcons();

      // Real-time Clock
      function updateClock() {
        const now = new Date();
        const timeStr = now.toISOString().slice(11, 19) + " UTC";
        document.getElementById('clock').textContent = timeStr;
      }
      setInterval(updateClock, 1000);
      updateClock();

      // Log formatter helper
      function addLog(message, type = 'system') {
        const consoleStream = document.getElementById('console-stream');
        const timestamp = new Date().toISOString().slice(11, 19);
        
        let colorClass = 'text-[#666]';
        let prefix = '⚙️';
        if (type === 'success') {
          colorClass = 'text-emerald-500';
          prefix = '🟢';
        } else if (type === 'error') {
          colorClass = 'text-rose-500 font-bold';
          prefix = '🔴';
        } else if (type === 'incoming') {
          colorClass = 'text-blue-400';
          prefix = '📥';
        } else if (type === 'outgoing') {
          colorClass = 'text-indigo-400';
          prefix = '📤';
        } else if (type === 'warn') {
          colorClass = 'text-amber-500';
          prefix = '⚠️';
        }

        const logDiv = document.createElement('div');
        logDiv.className = \`flex items-start gap-2 \${colorClass} leading-relaxed animate-[fadeIn_0.2s_ease-out]\`;
        logDiv.innerHTML = \`<span class="text-[#444]">\${timestamp}</span> <span class="flex-shrink-0">\${prefix}</span> <span>\${message}</span>\`;
        
        consoleStream.appendChild(logDiv);
        consoleStream.scrollTop = consoleStream.scrollHeight;
      }

      function clearConsoleLogs() {
        document.getElementById('console-stream').innerHTML = '';
        addLog('Terminal output cleared by mesh operator.');
      }

      // Clipboard helper
      function copyDeviceId() {
        if (!myDeviceId) return;
        navigator.clipboard.writeText(myDeviceId).then(() => {
          addLog('Copied device ID to clipboard: ' + myDeviceId, 'success');
        }).catch(() => {
          addLog('Failed to copy ID to clipboard.', 'error');
        });
      }

      // Establish WebSocket Connection
      function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = protocol + '//' + window.location.host;
        
        addLog('Establishing connection with gateway ' + wsUrl + ' ...', 'system');
        
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          addLog('Gateway connection established successfully.', 'success');
          document.getElementById('ping-indicator').className = 'relative inline-flex rounded-full h-2 w-2 bg-emerald-500';
          document.getElementById('ping-indicator-pulse').className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75';
          document.getElementById('status-badge').textContent = 'ONLINE';
          document.getElementById('status-badge').className = 'text-xs font-mono-custom text-emerald-400';
        };

        socket.onclose = () => {
          addLog('Gateway socket disconnected.', 'error');
          document.getElementById('ping-indicator').className = 'relative inline-flex rounded-full h-2 w-2 bg-rose-500';
          document.getElementById('ping-indicator-pulse').className = 'hidden';
          document.getElementById('status-badge').textContent = 'OFFLINE';
          document.getElementById('status-badge').className = 'text-xs font-mono-custom text-rose-500';
          
          // Disable interactive UI parts
          resetAppUI();
          
          // Reconnect attempt
          addLog('Scheduling reconnection in 5 seconds...', 'warn');
          setTimeout(connectWebSocket, 5000);
        };

        socket.onerror = (err) => {
          addLog('Socket encounter error event.', 'error');
        };

        socket.onmessage = (event) => {
          try {
            const packet = JSON.parse(event.data);
            handleIncomingPacket(packet);
          } catch (e) {
            addLog('Failed to parse incoming payload: ' + event.data, 'error');
          }
        };
      }

      // Handle websocket server packets
      function handleIncomingPacket(packet) {
        switch (packet.type) {
          case 'welcome':
            myDeviceId = packet.data.id;
            document.getElementById('local-id-display').textContent = myDeviceId;
            addLog('Assigned local Device ID: ' + myDeviceId, 'success');
            checkPairingRouter();
            break;

          case 'registry_update':
            const count = packet.data.count;
            document.getElementById('mesh-nodes-display').textContent = count + (count === 1 ? ' Node' : ' Nodes');
            break;

          case 'status_update':
            addLog(packet.data.message, packet.data.style || 'system');
            if (packet.data.status) {
              updateRoleUI(packet.data.status, packet.data.roleText, packet.data.badgeColor);
            }
            break;

          case 'connection_established':
            activePeerId = packet.data.peerId;
            currentRole = packet.data.role;
            addLog('Link confirmed. Tunnel open to peer: ' + activePeerId, 'success');
            
            // Activate the Sandbox Controls
            const sandbox = document.getElementById('sandbox-card');
            sandbox.classList.remove('opacity-40', 'pointer-events-none');
            sandbox.className = 'bg-[#151517] border-l-4 border-indigo-500 rounded-lg p-6 flex flex-col gap-4 transition-all duration-300 shadow-sm';
            document.getElementById('sandbox-title').textContent = 'Active Connection Sandbox';
            document.getElementById('sandbox-description').textContent = 'Linked with partner ID: ' + activePeerId + ' (' + currentRole + ')';
            document.getElementById('sandbox-icon-box').className = 'p-2.5 bg-indigo-500/20 rounded-lg text-indigo-400 shrink-0';
            document.getElementById('disconnect-btn').classList.remove('hidden');

            const stream = document.getElementById('chat-stream');
            stream.innerHTML = '<div class="text-emerald-500 font-bold">Secure connection established. Message relay operational.</div>';
            
            updateRoleUI('connected', 'Connected as ' + currentRole, 'bg-emerald-500');
            break;

          case 'message':
            addLog('Packet relayed from peer ' + packet.data.senderId, 'incoming');
            appendChatMessage(packet.data.senderId, packet.data.message, false);
            break;

          case 'peer_disconnected':
            addLog('Partner node ' + activePeerId + ' disconnected.', 'warn');
            appendChatMessage('System', 'Your connected partner disconnected from the gateway.', false, 'text-rose-500 font-bold');
            resetActiveLinkOnly();
            break;

          case 'error':
            addLog(packet.data.text, 'error');
            break;
        }
      }

      function updateRoleUI(status, roleText, badgeColor) {
        document.getElementById('role-status-display').textContent = roleText;
        const dot = document.getElementById('role-dot');
        dot.className = 'w-2.5 h-2.5 rounded-full ' + badgeColor;
        
        let sub = 'Waiting for custom protocol command';
        if (status === 'hosting') {
          sub = 'Awaiting outbound tap-in authentication';
        } else if (status === 'connected') {
          sub = 'Secure stream actively tunneled';
        }
        document.getElementById('role-subtext').textContent = sub;
      }

      function resetAppUI() {
        myDeviceId = null;
        document.getElementById('local-id-display').textContent = 'Generating...';
        document.getElementById('mesh-nodes-display').textContent = '1 Node';
        resetActiveLinkOnly();
      }

      function resetActiveLinkOnly() {
        activePeerId = null;
        currentRole = null;
        
        // Reset Sandbox
        const sandbox = document.getElementById('sandbox-card');
        sandbox.classList.add('opacity-40', 'pointer-events-none');
        sandbox.className = 'bg-[#151517] border-l-4 border-slate-700 rounded-lg p-6 flex flex-col gap-4 transition-all duration-300 shadow-sm';
        document.getElementById('sandbox-title').textContent = 'Active Relay Sandbox';
        document.getElementById('sandbox-description').textContent = 'No active device link established. Register as host or client to test real-time relays.';
        document.getElementById('sandbox-icon-box').className = 'p-2.5 bg-indigo-500/10 rounded-lg text-indigo-400 shrink-0';
        document.getElementById('disconnect-btn').classList.add('hidden');
        document.getElementById('chat-stream').innerHTML = '<div class="text-[#666] text-center italic my-auto">Await Link handshake validation</div>';
        
        updateRoleUI('idle', 'Idle / Standard Client', 'bg-slate-600');
      }

      // Host Registration trigger
      function startHosting() {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          addLog('Cannot register host: offline from gateway.', 'error');
          return;
        }
        let allowedClientId = document.getElementById('allowed-client-id').value.trim();
        if (!allowedClientId) {
          allowedClientId = 'ANY';
          document.getElementById('allowed-client-id').value = 'ANY';
          addLog('Allowed Client ID left blank. Defaulting to wildcard auth ("ANY").', 'warn');
        }
        if (allowedClientId === myDeviceId) {
          addLog('Invalid ID: You cannot authorize yourself as a client.', 'error');
          return;
        }

        addLog('Registering device as Host. Allowing target ID: ' + allowedClientId, 'system');
        socket.send(JSON.stringify({
          type: 'host_start',
          data: { allowedClientId }
        }));
      }

      // Client Tap-In trigger
      function tapIn() {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          addLog('Cannot request tap-in: offline from gateway.', 'error');
          return;
        }
        const targetHostId = document.getElementById('target-host-id').value.trim();
        if (!targetHostId) {
          addLog('Failed to connect: Target Host ID is required.', 'error');
          return;
        }
        if (targetHostId === myDeviceId) {
          addLog('Invalid ID: You cannot tap into your own device.', 'error');
          return;
        }

        addLog('Requesting outbound secure link to host: ' + targetHostId, 'system');
        socket.send(JSON.stringify({
          type: 'client_tap',
          data: { hostId: targetHostId }
        }));
      }

      // Send chat message
      function sendChatMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        if (!message) return;

        if (!socket || socket.readyState !== WebSocket.OPEN || !activePeerId) {
          addLog('Message failed: Active partner route not found.', 'error');
          return;
        }

        socket.send(JSON.stringify({
          type: 'send_message',
          data: { message }
        }));

        appendChatMessage(myDeviceId + ' (You)', message, true);
        addLog('Packet relayed to peer ' + activePeerId, 'outgoing');
        input.value = '';
      }

      function appendChatMessage(sender, text, isSelf, customStyle = '') {
        const stream = document.getElementById('chat-stream');
        
        // Remove empty placeholder
        if (stream.querySelector('.italic')) {
          stream.innerHTML = '';
        }

        const msgDiv = document.createElement('div');
        msgDiv.className = \`p-2.5 rounded border border-[#222] \${isSelf ? 'bg-indigo-950/20 text-indigo-300' : 'bg-black/30 text-[#E0E0E0]'} \${customStyle}\`;
        msgDiv.innerHTML = \`<span class="font-bold text-[10px] block text-[#666] mb-0.5 font-mono-custom">\${sender}:</span><span>\${text}</span>\`;
        
        stream.appendChild(msgDiv);
        stream.scrollTop = stream.scrollHeight;
      }

      function terminateLink() {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({ type: 'terminate_link' }));
        addLog('Requested termination of the active secure tunnel.', 'warn');
        resetActiveLinkOnly();
      }

      // Handle Enter Key in input fields
      document.getElementById('allowed-client-id').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') startHosting();
      });
      document.getElementById('target-host-id').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') tapIn();
      });
      document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
      });

      // Check if URL has pairing parameters on load/welcome
      function checkPairingRouter() {
        const params = new URLSearchParams(window.location.search);
        const pairParam = params.get('pair');
        const modeParam = params.get('mode');
        
        if (modeParam === 'mobile' || pairParam) {
          // Display the mobile mode banner
          const banner = document.getElementById('mobile-mode-banner');
          if (banner) {
            banner.classList.remove('hidden');
            banner.classList.add('flex');
          }
          
          if (pairParam) {
            addLog('[Router] Dynamic Pairing Parameter intercepted from URL scan: ' + pairParam, 'success');
            
            // Auto-fill target host ID
            const targetInput = document.getElementById('target-host-id');
            if (targetInput) {
              targetInput.value = pairParam;
            }
            
            // Auto trigger tapIn after a tiny delay to ensure the WebSocket is fully initialized
            setTimeout(() => {
              addLog('[Router] Auto-initiating secure tunnel tap-in to Host: ' + pairParam, 'system');
              tapIn();
            }, 800);
          }
        }
      }

      // Toggle QR Code Display with Auto Public URL Translation and Pairing PIN
      function toggleQrCode() {
        const qrPanel = document.getElementById('qr-panel');
        const qrImage = document.getElementById('qr-image');
        const qrUrlSpan = document.getElementById('qr-current-url');
        
        if (qrPanel.classList.contains('hidden')) {
          if (!myDeviceId) {
            addLog('Cannot generate pairing QR code: waiting for local device ID.', 'warn');
            return;
          }
          
          // Construct the dynamic, environment-aware pairing URL
          let pairingUrl = window.location.origin + '/?pair=' + myDeviceId + '&mode=mobile';
          
          // Auto-translate Development URLs to Public Shareable/Preview URLs to avoid the Google Auth wall!
          if (pairingUrl.includes('ais-dev-')) {
            pairingUrl = pairingUrl.replace('ais-dev-', 'ais-pre-');
          }
          
          qrUrlSpan.textContent = pairingUrl;
          
          // Generate the high-quality QR code image using api.qrserver.com
          qrImage.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(pairingUrl);
          
          qrPanel.classList.remove('hidden');
          qrPanel.classList.add('flex');
          addLog('Dynamic Pairing QR Code generated for URL: ' + pairingUrl, 'success');
        } else {
          qrPanel.classList.add('hidden');
          qrPanel.classList.remove('flex');
        }
      }

      function copyCurrentUrl() {
        if (!myDeviceId) {
          addLog('Device ID not generated yet. Please wait.', 'warn');
          return;
        }
        let pairingUrl = window.location.origin + '/?pair=' + myDeviceId + '&mode=mobile';
        if (pairingUrl.includes('ais-dev-')) {
          pairingUrl = pairingUrl.replace('ais-dev-', 'ais-pre-');
        }
        navigator.clipboard.writeText(pairingUrl).then(() => {
          addLog('Copied dynamic pairing URL to clipboard.', 'success');
        }).catch(() => {
          addLog('Failed to copy pairing URL.', 'error');
        });
      }

      function simulateMobileTab() {
        if (!myDeviceId) {
          addLog('Please wait for device ID to generate before simulating.', 'warn');
          return;
        }
        // For same-browser testing, we keep the dev origin so the active auth session is preserved!
        let simUrl = window.location.origin + '/?pair=' + myDeviceId + '&mode=mobile';
        addLog('Launching side-by-side simulated mobile client: ' + simUrl, 'system');
        window.open(simUrl, '_blank');
      }

      // Launch connection
      connectWebSocket();
    </script>
  </body>
</html>
  `);
});

// Create HTTP server instance
const server = createServer(app);

// Attach WebSocket server on top of the same HTTP server instance
const wss = new WebSocketServer({ server });

// WebSocket Connection Handlers
wss.on('connection', (ws) => {
  // Generate a random unique device ID
  const clientId = 'DEV-' + Math.floor(1000 + Math.random() * 9000);
  
  // Create state registry entry
  const clientState = {
    ws,
    id: clientId,
    status: 'idle',
    role: null,
    partnerId: null,
    allowedClientId: null
  };
  
  // Register client
  deviceRegistry.set(clientId, clientState);
  
  // Send welcome ID
  ws.send(JSON.stringify({
    type: 'welcome',
    data: { id: clientId }
  }));

  // Broadcast updated registry size
  broadcastRegistryCount();

  ws.on('message', (message) => {
    try {
      const packet = JSON.parse(message);
      handleClientPacket(clientId, packet);
    } catch (e) {
      console.error('Error handling message from client ' + clientId, e);
    }
  });

  ws.on('close', () => {
    // Gracefully handle peer disconnect
    const state = deviceRegistry.get(clientId);
    if (state && state.partnerId) {
      const partnerState = deviceRegistry.get(state.partnerId);
      if (partnerState) {
        partnerState.status = 'idle';
        partnerState.role = null;
        partnerState.partnerId = null;
        partnerState.allowedClientId = null;
        
        if (partnerState.ws.readyState === WebSocket.OPEN) {
          partnerState.ws.send(JSON.stringify({
            type: 'peer_disconnected'
          }));
        }
      }
    }
    
    // Remove from registry Map
    deviceRegistry.delete(clientId);
    broadcastRegistryCount();
  });
});

// Process client WebSocket requests
function handleClientPacket(clientId, packet) {
  const clientState = deviceRegistry.get(clientId);
  if (!clientState) return;

  switch (packet.type) {
    case 'host_start': {
      const { allowedClientId } = packet.data;
      
      // Update local client registry states
      clientState.role = 'host';
      clientState.status = 'hosting';
      clientState.allowedClientId = allowedClientId;
      clientState.partnerId = null;

      clientState.ws.send(JSON.stringify({
        type: 'status_update',
        data: {
          status: 'hosting',
          roleText: 'Host Connection (Waiting)',
          badgeColor: 'bg-emerald-500/70',
          message: 'Local node waiting for Tap-In requests from Client ID ' + allowedClientId,
          style: 'warn'
        }
      }));

      // Check if that allowed client is already waiting/trying to tap into this host
      if (allowedClientId === 'ANY') {
        for (const peer of deviceRegistry.values()) {
          if (peer.role === 'client' && peer.partnerId === clientId && peer.status === 'tapping') {
            establishTunnel(clientId, peer.id);
            break;
          }
        }
      } else {
        const prospectiveClient = deviceRegistry.get(allowedClientId);
        if (prospectiveClient && prospectiveClient.role === 'client' && prospectiveClient.partnerId === clientId) {
          // Double match found! Link them!
          establishTunnel(clientId, allowedClientId);
        }
      }
      break;
    }

    case 'client_tap': {
      const { hostId } = packet.data;
      
      const hostState = deviceRegistry.get(hostId);
      if (!hostState) {
        clientState.ws.send(JSON.stringify({
          type: 'error',
          data: { text: 'Validation Error: Device Host ID (' + hostId + ') is offline or does not exist.' }
        }));
        return;
      }

      // Check if host has allowed this specific client ID or has a wildcard ANY set
      if (hostState.status === 'hosting' && (hostState.allowedClientId === clientId || hostState.allowedClientId === 'ANY')) {
        // Authenticated! Establish connection immediately
        clientState.role = 'client';
        clientState.partnerId = hostId;
        clientState.status = 'connected';
        
        establishTunnel(hostId, clientId);
      } else {
        // Pending state - client is requesting, host hasn't allowed yet, or host is busy
        clientState.role = 'client';
        clientState.partnerId = hostId;
        clientState.status = 'tapping';

        clientState.ws.send(JSON.stringify({
          type: 'status_update',
          data: {
            status: 'tapping',
            roleText: 'Client Tap-In (Requested)',
            badgeColor: 'bg-amber-500/80',
            message: 'Outbound secure request sent. Awaiting authorization matching on Host ID ' + hostId,
            style: 'warn'
          }
        }));
      }
      break;
    }

    case 'send_message': {
      if (clientState.partnerId) {
        const partner = deviceRegistry.get(clientState.partnerId);
        if (partner && partner.ws.readyState === WebSocket.OPEN) {
          partner.ws.send(JSON.stringify({
            type: 'message',
            data: {
              senderId: clientId,
              message: packet.data.message
            }
          }));
        }
      } else {
        clientState.ws.send(JSON.stringify({
          type: 'error',
          data: { text: 'Relay failed: No active peer connected.' }
        }));
      }
      break;
    }

    case 'terminate_link': {
      const partnerId = clientState.partnerId;
      if (partnerId) {
        const partnerState = deviceRegistry.get(partnerId);
        if (partnerState) {
          partnerState.status = 'idle';
          partnerState.role = null;
          partnerState.partnerId = null;
          partnerState.allowedClientId = null;
          
          if (partnerState.ws.readyState === WebSocket.OPEN) {
            partnerState.ws.send(JSON.stringify({
              type: 'peer_disconnected'
            }));
          }
        }
      }
      
      clientState.status = 'idle';
      clientState.role = null;
      clientState.partnerId = null;
      clientState.allowedClientId = null;
      break;
    }
  }
}

// Establish tunnel between Host and Client
function establishTunnel(hostId, clientId) {
  const hostState = deviceRegistry.get(hostId);
  const clientState = deviceRegistry.get(clientId);

  if (!hostState || !clientState) return;

  // Complete cross-references
  hostState.partnerId = clientId;
  hostState.status = 'connected';

  clientState.partnerId = hostId;
  clientState.status = 'connected';

  // Dispatch success confirmation to Host
  hostState.ws.send(JSON.stringify({
    type: 'connection_established',
    data: {
      peerId: clientId,
      role: 'host'
    }
  }));

  // Dispatch success confirmation to Client
  clientState.ws.send(JSON.stringify({
    type: 'connection_established',
    data: {
      peerId: hostId,
      role: 'client'
    }
  }));
}

// Broadcast node count to all online clients
function broadcastRegistryCount() {
  const totalCount = deviceRegistry.size;
  const payload = JSON.stringify({
    type: 'registry_update',
    data: { count: totalCount }
  });

  for (const client of deviceRegistry.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

// Start Server Switchboard
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[UniNet] Server listening on http://0.0.0.0:${PORT}`);
});
