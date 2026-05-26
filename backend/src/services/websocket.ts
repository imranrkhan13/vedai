import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { getRedis } from './redis';
import Redis from 'ioredis';

const clients = new Map<string, WebSocket>();

export function initWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', 'http://localhost');
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

  // Redis pub/sub subscriber (separate connection from main client)
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const isTLS = redisUrl.startsWith('rediss://');
    const sub = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      tls: isTLS ? { rejectUnauthorized: false } : undefined,
    });

    sub.subscribe('ws:notify', (err) => {
      if (err) console.error('Redis subscribe error:', err.message);
      else console.log('✅ WebSocket + Redis pub/sub initialized');
    });

    sub.on('message', (_channel, message) => {
      try {
        const { clientId, payload } = JSON.parse(message);
        if (clientId === '__all__') {
          clients.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload)); });
        } else {
          const ws = clients.get(clientId);
          if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
        }
      } catch {}
    });
  } catch (err) {
    console.error('Redis pub/sub init failed:', err);
  }
}

export function notifyClient(clientId: string, payload: object) {
  // Try direct first (same process)
  const ws = clients.get(clientId);
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
    return;
  }
  // Cross-process via Redis pub/sub
  getRedis().publish('ws:notify', JSON.stringify({ clientId, payload })).catch(() => {});
}
