import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { connectDB } from './services/db';
import { initWebSocket } from './services/websocket';
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
    if (origin.includes('vedai') || origin.includes('localhost') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Routes
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
}

start().catch(console.error);
