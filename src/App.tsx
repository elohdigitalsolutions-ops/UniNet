import React, { useState, useEffect, useRef } from 'react';
import { LogEntry, ChatMessage, ConnectionStatus, StatusUpdateData } from './types';
import { SystemHeader } from './components/SystemHeader';
import { MobileModeBanner } from './components/MobileModeBanner';
import { QuickInfoCards } from './components/QuickInfoCards';
import { PairingQRPanel } from './components/PairingQRPanel';
import { HostConfiguration } from './components/HostConfiguration';
import { ClientConnection } from './components/ClientConnection';
import { RelaySandbox } from './components/RelaySandbox';
import { SystemLogsConsole } from './components/SystemLogsConsole';
import { SystemFooter } from './components/SystemFooter';

export default function App() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('OFFLINE');
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [nodeCount, setNodeCount] = useState<number>(1);
  const [activePeerId, setActivePeerId] = useState<string | null>(null);

  // UI state representation
  const [roleStatusText, setRoleStatusText] = useState<string>('Idle / Standard Client');
  const [roleSubtext, setRoleSubtext] = useState<string>('Waiting for custom protocol command');
  const [roleDotClass, setRoleDotClass] = useState<string>('bg-slate-600');

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isMobileMode, setIsMobileMode] = useState<boolean>(false);
  
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [initialTargetId, setInitialTargetId] = useState<string>('');

  const socketRef = useRef<WebSocket | null>(null);

  // Helper to add logs with dynamic key matching
  const addLog = (message: string, type: LogEntry['type'] = 'system') => {
    const timestamp = new Date().toISOString().slice(11, 19);
    const newLog: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp,
      message,
      type,
    };
    setLogs((prev) => [...prev, newLog]);
  };

  // Helper to add chat messages
  const appendChatMessage = (sender: string, text: string, isSelf: boolean, customStyle: string = '') => {
    const newMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender,
      text,
      isSelf,
      customStyle,
    };
    setChatMessages((prev) => [...prev, newMsg]);
  };

  // Initialize URL Query parameters router
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pairParam = params.get('pair');
    const modeParam = params.get('mode');

    if (modeParam === 'mobile' || pairParam) {
      setIsMobileMode(true);
    }
    if (pairParam) {
      setInitialTargetId(pairParam);
    }
  }, []);

  // WebSocket lifecycle connection manager
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsHost = window.location.host;

    // Netlify/GitHub Static Deployment Fallback Routing Strategy:
    // If the client host is not our Europe Cloud Run runtime, route to our live preview broker!
    if (
      !wsHost.includes('europe-west2.run.app') &&
      !wsHost.includes('localhost') &&
      !wsHost.includes('127.0.0.1')
    ) {
      wsHost = 'ais-pre-ni3o2vaxtkxxcy5sguyytz-17612676419.europe-west2.run.app';
    }

    const wsUrl = `${protocol}//${wsHost}`;
    addLog(`Establishing connection with gateway ${wsUrl} ...`, 'system');

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnectionStatus('ONLINE');
      addLog('Gateway connection established successfully.', 'success');
    };

    socket.onclose = () => {
      setConnectionStatus('OFFLINE');
      setDeviceId(null);
      addLog('Gateway socket disconnected.', 'error');
      
      // Reset state representation
      setRoleStatusText('Idle / Standard Client');
      setRoleSubtext('Waiting for custom protocol command');
      setRoleDotClass('bg-slate-600');
      setActivePeerId(null);
      setChatMessages([]);

      // Attempt reconnection
      addLog('Scheduling reconnection in 5 seconds...', 'warn');
      setTimeout(() => {
        // Simple trick to trigger useEffect reload
        setConnectionStatus((prev) => (prev === 'OFFLINE' ? 'OFFLINE' : 'OFFLINE'));
      }, 5000);
    };

    socket.onerror = () => {
      addLog('Socket encountered error event.', 'error');
    };

    socket.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        switch (packet.type) {
          case 'welcome': {
            const assignedId = packet.data.id;
            setDeviceId(assignedId);
            addLog(`Assigned local Device ID: ${assignedId}`, 'success');
            break;
          }
          case 'registry_update': {
            setNodeCount(packet.data.count);
            break;
          }
          case 'status_update': {
            const update = packet.data as StatusUpdateData;
            setRoleStatusText(update.roleText || 'Status Updated');
            setRoleSubtext(update.message);
            setRoleDotClass(update.badgeColor || 'bg-indigo-500');
            addLog(update.message, update.style || 'system');
            break;
          }
          case 'connection_established': {
            const peer = packet.data.peerId;
            setActivePeerId(peer);
            setRoleStatusText(`Connected with ${peer}`);
            setRoleSubtext(`Tunnel cross-linked successfully with device ${peer}.`);
            setRoleDotClass('bg-indigo-500');
            addLog(`Dynamic link established with peer node: ${peer}`, 'success');
            appendChatMessage('SYSTEM', `Secure link cross-referenced with ${peer}. Ready to relay.`, false, 'bg-indigo-900/10 text-indigo-400 font-bold');
            break;
          }
          case 'peer_disconnected': {
            addLog('Linked partner has disconnected from the gateway network.', 'error');
            appendChatMessage('SYSTEM', 'Tunnel link broken: partner disconnected.', false, 'bg-rose-950/15 text-rose-400 font-bold');
            setActivePeerId(null);
            setRoleStatusText('Idle / Standard Client');
            setRoleSubtext('Waiting for custom protocol command');
            setRoleDotClass('bg-slate-600');
            break;
          }
          case 'message': {
            const sender = packet.data.senderId;
            const msg = packet.data.message;
            appendChatMessage(sender, msg, false);
            addLog(`Received inbound packet from peer ${sender}`, 'incoming');
            break;
          }
          case 'error': {
            addLog(packet.data.text, 'error');
            break;
          }
          default:
            addLog(`Unhandled packet type received: ${packet.type}`, 'warn');
        }
      } catch (err) {
        addLog(`Failed to parse incoming payload: ${event.data}`, 'error');
      }
    };

    return () => {
      socket.close();
    };
  }, []);

  // Handle URL Pairing Router trigger
  useEffect(() => {
    if (deviceId && socketRef.current && socketRef.current.readyState === WebSocket.OPEN && initialTargetId) {
      if (initialTargetId === deviceId) {
        addLog('Cannot tap into your own device.', 'error');
        return;
      }
      addLog(`[Router] Dynamic Pairing Parameter intercepted from URL: ${initialTargetId}`, 'success');
      const timer = setTimeout(() => {
        addLog(`[Router] Auto-initiating secure tunnel tap-in to Host: ${initialTargetId}`, 'system');
        socketRef.current?.send(JSON.stringify({
          type: 'client_tap',
          data: { hostId: initialTargetId }
        }));
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [deviceId, initialTargetId]);

  // Action methods
  const handleCopyId = () => {
    if (!deviceId) return;
    navigator.clipboard.writeText(deviceId).then(() => {
      setCopiedId(true);
      addLog('Copied local Device ID to clipboard.', 'success');
      setTimeout(() => setCopiedId(false), 2000);
    });
  };

  const handleCopyUrl = () => {
    if (!deviceId) return;
    let pairingUrl = window.location.origin + '/?pair=' + deviceId + '&mode=mobile';
    if (pairingUrl.includes('ais-dev-')) {
      pairingUrl = pairingUrl.replace('ais-dev-', 'ais-pre-');
    }
    navigator.clipboard.writeText(pairingUrl).then(() => {
      setCopiedUrl(true);
      addLog('Copied dynamic pairing URL to clipboard.', 'success');
      setTimeout(() => setCopiedUrl(false), 2000);
    });
  };

  const handleSimulateMobile = () => {
    if (!deviceId) {
      addLog('Please wait for device ID to generate before simulating.', 'warn');
      return;
    }
    const simUrl = `${window.location.origin}/?pair=${deviceId}&mode=mobile`;
    addLog(`Launching side-by-side simulated mobile client: ${simUrl}`, 'system');
    window.open(simUrl, '_blank');
  };

  const handleStartHosting = (allowedClientId: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      addLog('Cannot register host: offline from gateway.', 'error');
      return;
    }
    if (allowedClientId === deviceId) {
      addLog('Invalid ID: You cannot authorize yourself as a client.', 'error');
      return;
    }

    addLog(`Sending Hosting Registration Frame for peer allowed client ID: ${allowedClientId}`, 'system');
    socketRef.current.send(JSON.stringify({
      type: 'host_start',
      data: { allowedClientId }
    }));
  };

  const handleTapIn = (targetHostId: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      addLog('Cannot tap in: offline from gateway.', 'error');
      return;
    }
    if (targetHostId === deviceId) {
      addLog('Invalid ID: You cannot tap into your own device.', 'error');
      return;
    }

    addLog(`Requesting outbound secure link to host: ${targetHostId}`, 'system');
    socketRef.current.send(JSON.stringify({
      type: 'client_tap',
      data: { hostId: targetHostId }
    }));
  };

  const handleSendMessage = (message: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !activePeerId) {
      addLog('Message failed: Active partner route not found.', 'error');
      return;
    }

    socketRef.current.send(JSON.stringify({
      type: 'send_message',
      data: { message }
    }));

    appendChatMessage(`${deviceId} (You)`, message, true);
    addLog(`Packet relayed to peer ${activePeerId}`, 'outgoing');
  };

  const handleTerminateLink = () => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    addLog('Terminating active dynamic link...', 'system');
    socketRef.current.send(JSON.stringify({
      type: 'terminate_link'
    }));

    // Reset local state representation
    setRoleStatusText('Idle / Standard Client');
    setRoleSubtext('Waiting for custom protocol command');
    setRoleDotClass('bg-slate-600');
    setActivePeerId(null);
    setChatMessages([]);
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  const isOnline = connectionStatus === 'ONLINE';

  return (
    <div className="bg-[#0A0A0B] text-[#E0E0E0] min-h-screen flex flex-col selection:bg-indigo-600 selection:text-white">
      <SystemHeader connectionStatus={connectionStatus} />

      {/* Main Dashboard Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        <MobileModeBanner isVisible={isMobileMode} />

        <QuickInfoCards
          deviceId={deviceId}
          roleStatusText={roleStatusText}
          roleSubtext={roleSubtext}
          roleDotClass={roleDotClass}
          nodeCount={nodeCount}
          onCopyId={handleCopyId}
          copied={copiedId}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Controllers and QR Display (Left Side, 7 Columns) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <PairingQRPanel
              deviceId={deviceId}
              onCopyUrl={handleCopyUrl}
              copiedUrl={copiedUrl}
              onSimulateMobile={handleSimulateMobile}
            />

            <HostConfiguration
              onStartHosting={handleStartHosting}
              isOnline={isOnline}
            />

            <ClientConnection
              onTapIn={handleTapIn}
              isOnline={isOnline}
              initialTargetId={initialTargetId}
            />

            <RelaySandbox
              isActive={!!activePeerId}
              partnerId={activePeerId}
              chatMessages={chatMessages}
              onSendMessage={handleSendMessage}
              onTerminateLink={handleTerminateLink}
            />
          </div>

          {/* System Logs Console (Right Side, 5 Columns) */}
          <SystemLogsConsole
            logs={logs}
            onClear={handleClearLogs}
            isOnline={isOnline}
          />
        </div>
      </main>

      <SystemFooter />
    </div>
  );
}
