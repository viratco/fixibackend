import { Queue } from 'bullmq';

// ─── Redis Connection (plain options object — avoids IORedis version conflict) --
// BullMQ bundles its own ioredis internally; passing a plain config object
// is the safest way to avoid type mismatches between the two ioredis builds.
export const redisConnection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null as null, // Required by BullMQ
    enableReadyCheck: false,
};

// ─── Recurring Job Data Shape ─────────────────────────────────────
export interface RecurringJobData {
    recurringBookingId: string;
    userId: string;
    serviceId: string;
    address: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    dailyHours: number;
    dayIndex: number;
    scheduledAt: string; // ISO string
}

// ─── Recurring Bookings Queue ─────────────────────────────────────
export const recurringQueue = new Queue<RecurringJobData>('recurring-bookings', {
    connection: redisConnection,
    defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
    },
});

recurringQueue.on('error', (err) => console.error('❌ Redis Queue error:', err.message));

