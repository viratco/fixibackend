import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient } from '../config/redis';

// Generic auth limiter: 15 minutes window, max 10 attempts
// Prevents brute-force on login/register/otp
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Reverted from 1000, slightly higher than original 10 for dev comfort
  standardHeaders: true, 
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes',
  },
  store: new RedisStore({
    // @ts-expect-error - ioredis types sometimes mismatch with rate-limit-redis
    sendCommand: (...args: string[]) => redisClient.call(...args),
  }),
});

// Stricter limiter for OTP sending: 5 attempts per 15 mins
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25, // Reverted from 1000, slightly higher than original 5 for dev comfort
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many OTP requests. Please wait 15 minutes before trying again.',
  },
  store: new RedisStore({
    // @ts-expect-error - ioredis types sometimes mismatch with rate-limit-redis
    sendCommand: (...args: string[]) => redisClient.call(...args),
  }),
});
