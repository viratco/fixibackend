const { Queue } = require('bullmq');
const Redis = require('ioredis');

const redisConnection = new Redis({
  host: '127.0.0.1',
  port: 6379,
  maxRetriesPerRequest: null,
});

async function main() {
  console.log('--- CLEARING REDIS QUEUE ---');
  try {
    const recurringQueue = new Queue('recurring-bookings', { 
        connection: redisConnection 
    });

    console.log('Obtaining jobs...');
    // Clear all pending, active, and delayed jobs
    await recurringQueue.drain(true);
    await recurringQueue.clean(0, 1000, 'delayed');
    await recurringQueue.clean(0, 1000, 'wait');
    await recurringQueue.clean(0, 1000, 'active');
    await recurringQueue.clean(0, 1000, 'completed');
    await recurringQueue.clean(0, 1000, 'failed');

    console.log('Redis queue cleared successfully.');
  } catch (e) {
    console.error('ERROR during Redis clear:', e.message);
  } finally {
    await redisConnection.quit();
  }
}

main();
