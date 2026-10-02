import { shouldRunWorkerInWeb, startWorker } from './worker';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { connectDB } from './services/db';
import { initWebSocket } from './services/websocket';
import { verifyToken } from './services/auth';
import authRoutes from './routes/auth';
import assignmentRoutes from './routes/assignments';
import jobRoutes from './routes/jobs';

// Load .env ONLY in development — Render injects env vars directly
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app = express();
const httpServer = createServer(app);

// Accept ALL origins in production (Vercel URL changes on each deploy)
// or lock to FRONTEND_URL if set
const allowedOrigins = process.env.FRONTEND_URL
  ? [
      process.env.FRONTEND_URL,
      process.env.FRONTEND_URL.replace(/\/$/, ''), // strip trailing slash
      'http://localhost:3000',
      'https://vedai-coral.vercel.app',
    ]
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Render health checks)
    if (!origin) return callback(null, true);
    // Allow any vercel.app domain for this project
    if (/^https:\/\/vedai[a-z0-9-]*\.vercel\.app$/.test(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin) || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Protect the free-model daily cap: limit generation requests per IP (in memory, no new dependency)
const genHits = new Map<string, number[]>();
app.use((req, res, next) => {
  const isGen = req.method === 'POST' && /^\/api\/assignments(\/[^/]+\/regenerate)?\/?$/.test(req.path);
  const uid = (() => { const h = req.headers.authorization || ''; return h.startsWith('Bearer ') ? verifyToken(h.slice(7)) : null; })();
  if (!isGen) return next();
  const ip = uid ? `user:${uid}` : String(req.headers['x-forwarded-for'] || req.ip || '').split(',').pop()!.trim();
  const now = Date.now();
  const hits = (genHits.get(ip) || []).filter((t) => now - t < 3600_000);
  if (hits.length >= Number(process.env.GEN_LIMIT_PER_HOUR || 10)) {
    return res.status(429).json({ success: false, error: 'Too many generation requests. Try again later.' });
  }
  hits.push(now);
  genHits.set(ip, hits);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/jobs', jobRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

// Keep-alive ping for Render free tier (prevents 50s cold start)
if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL) {
  const url = `${process.env.RENDER_EXTERNAL_URL}/api/health`;
  setInterval(() => {
    fetch(url).catch(() => {});
  }, 14 * 60 * 1000); // every 14 min
  console.log(`🔄 Keep-alive enabled → ${url}`);
}

// WebSocket
initWebSocket(httpServer);

const PORT = parseInt(process.env.PORT || '4000', 10);

async function start() {
  await connectDB();
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 VedaAI Backend running on port ${PORT}`);
    console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`🌍 FRONTEND_URL: ${process.env.FRONTEND_URL}`);
  });
  if (shouldRunWorkerInWeb()) {
    await startWorker({ connect: false });
  } else {
    console.log('ℹ️ Queue worker not started in web process (set WORKER_IN_WEB=true to enable)');
  }
}

start().catch(console.error);
