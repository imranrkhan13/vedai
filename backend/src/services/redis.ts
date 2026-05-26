import Redis from 'ioredis';

let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (!redisClient) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    
    // Upstash uses rediss:// (TLS) — needs tls option
    const isTLS = url.startsWith('rediss://');
    
    redisClient = new Redis(url, {
      maxRetriesPerRequest: null,
      tls: isTLS ? { rejectUnauthorized: false } : undefined,
      lazyConnect: false,
    });

    redisClient.on('connect', () => console.log('✅ Redis connected'));
    redisClient.on('error', (err) => console.error('❌ Redis error:', err.message));
  }
  return redisClient;
}
