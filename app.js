import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Device Registry Map to track connected WebSocket clients
  const deviceRegistry = new Map();

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
        const packet = JSON.parse(message.toString());
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

          if (hostState.status === 'hosting' && (hostState.allowedClientId === clientId || hostState.allowedClientId === 'ANY')) {
            clientState.role = 'client';
            clientState.partnerId = hostId;
            clientState.status = 'connected';
            establishTunnel(hostId, clientId);
          } else {
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

      hostState.partnerId = clientId;
      hostState.status = 'connected';

      clientState.partnerId = hostId;
      clientState.status = 'connected';

      hostState.ws.send(JSON.stringify({
        type: 'connection_established',
        data: {
          peerId: clientId,
          role: 'host'
        }
      }));

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
  });

  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  // Integrate Vite Dev Server middleware in non-production, unless build files exist
  if (process.env.NODE_ENV !== 'production' && !hasDist) {
    console.log('[UniNet] Starting in DEVELOPMENT mode (Vite Middleware active)');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    console.log(`[UniNet] Starting in PRODUCTION mode (Serving static assets from ${distPath})`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[UniNet] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
