import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { verifyToken } from './auth';

const clients = new Map<string, WebSocket>();

export function initWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', 'http://localhost');
    const uid = verifyToken(url.searchParams.get('ticket') || '', 'ws');
    if (!uid || uid.startsWith('student:')) { ws.close(1008, 'Sign in required'); return; }
    const clientId = url.searchParams.get('clientId') || Math.random().toString(36).slice(2);
    clients.set(clientId, ws);
    console.log(`WS connected: ${clientId} (total: ${clients.size})`);

    ws.on('close', () => {
      clients.delete(clientId);
      console.log(`WS disconnected: ${clientId}`);
    });

    ws.on('error', () => clients.delete(clientId));
    ws.send(JSON.stringify({ type: 'connected', clientId }));
  });

}

export function notifyClient(clientId: string, payload: object) {
  // Try direct first (same process)
  const ws = clients.get(clientId);
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
    return;
  }
  // Separate workers report persisted status through the frontend's polling.
}
