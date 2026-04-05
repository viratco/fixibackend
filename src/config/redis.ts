import Redis from 'ioredis';

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

// Standard IORedis instance for general use (like rate limiting)
export const redisClient = new Redis(redisConfig);

redisClient.on('error', (err) => console.error('🔴 [Redis] Error:', err.message));
redisClient.on('connect', () => console.log('🟢 [Redis] Connected'));

export default redisClient;
